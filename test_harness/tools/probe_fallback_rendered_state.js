#!/usr/bin/env node
/**
 * probe_fallback_rendered_state.js -- PENDING_DECISIONS #199 / #204: what does the REAL PAGE render, not what does the field say. A read-only probe, not a test: it writes nothing and exits 0.
 *
 *   node test_harness/tools/probe_fallback_rendered_state.js [proposal.json]
 *
 * Written for the operator's 03:38 NY ruling on #199 ("Verify the rendered state, not the field"): the Dishwasher Repair fallback's "Leaking water" option carries
 * `checkout_state_override: diagnostic` on the washer's `symptom` module, and the symptom batch would re-point the fallback to `dishwasher_symptom`, whose "Leaking water" carries none.
 * The measurement (measure_symptom_batch_proposal.js) reads the engine's quote and reports that state moving. This tool loads qr.html in jsdom (the way verify_state_ignorance.js does),
 * types a phrase into the text bar, answers the card and reads what is drawn and what the cart holds, on the catalog as it is and on the catalog with the batch applied IN MEMORY.
 *
 *   A. The same answer on a service and on a fallback. "washer is broken" reaches the service washer_repair; "dishwasher problem" reaches the dynamic fallback
 *      minor_home_repairs+minor_home_repairs_appliances_dishwasher+Repair. Both are answered "Leaking water". The engine's own state for the answer is printed beside the render.
 *   B. The guided builder's "What's the issue?" chips, per appliance group (bldGetConditionChoices), as it is and with the batch: where the builder's list comes from.
 *   C. The guided builder (Dishwasher > Fix / Repair > Something else) answered with three different symptoms, driven to the quote: what the chosen symptom does to the price.
 */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = process.env.QR_ROOT || path.resolve(__dirname, '..', '..');
const { JSDOM } = require(path.join(ROOT, 'test_harness', 'node_modules', 'jsdom'));
const { readPage } = require(path.join(ROOT, 'test_harness', '_page.js'));
const FILE = process.argv[2] || path.join(__dirname, 'symptom_batches', 'appliance_symptoms_T173_proposal.json');
const P = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const DB0 = JSON.parse(fs.readFileSync(path.join(ROOT, 'btnyc.json'), 'utf8'));
const clone = o => JSON.parse(JSON.stringify(o)), norm = s => String(s || '').replace(/[‘’]/g, "'").trim();
const wait = ms => new Promise(r => setTimeout(r, ms)), clean = s => String(s || '').replace(/\s+/g, ' ').trim();
const text = e => { if (!e) return ''; const c = e.cloneNode(true); c.querySelectorAll('script,style').forEach(n => n.remove()); return clean(c.textContent); };

// the batch, applied in memory (the same rules as measure_symptom_batch_proposal.js)
function applyBatch(db) {
  const out = clone(db), oldSym = db.intake_modules.symptom.client_response;
  for (const [key, m] of Object.entries(P.modules)) {
    out.intake_modules[key] = { question: m.question, type: 'single', purpose: 'pricing', confidence_gain: 20, affects_price: true,
      client_response: m.options.map(o => { if (o.copy_of) return clone(oldSym.find(x => norm(x.label) === norm(o.label))); const r = { label: o.label, tags: o.tags || [] }; for (const k of ['complexity_override', 'modifier_ref', 'checkout_state_override']) if (o[k]) r[k] = o[k]; return r; }) };
  }
  const swap = (e, from, to) => { e.intake_chain = (e.intake_chain || []).map(s => (s && s.module === from) ? Object.assign({}, s, { module: to }) : (s === from ? to : s)); };
  for (const [sid, r] of Object.entries(P.repoint.services)) swap(out.services.find(s => s.id === sid), r.from, r.to);
  for (const [key, to] of Object.entries(P.repoint.dynamic)) swap(out.dynamic_services[key], 'symptom', to);
  return out;
}

const HTML = readPage(path.join(ROOT, 'qr.html'), ROOT);
async function open(db) {
  const dom = new JSDOM(HTML, { url: 'https://tommichael88.github.io/booktomnyc/qr.html', runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true, beforeParse(w) {
    w.fetch = async u => String(u).includes('btnyc.json') ? { ok: true, json: async () => clone(db) } : { ok: false, status: 404 };
    w.HTMLElement.prototype.scrollIntoView = function () {}; w.console.log = () => {}; w.console.warn = () => {}; w.console.error = () => {};
  } });
  await wait(2500); return dom;
}

// A. type a phrase, answer the one symptom question on the card, then add to the request; report what is drawn and what the cart holds
async function typed(db, phrase, label) {
  const dom = await open(db), w = dom.window, doc = w.document, tap = el => el.dispatchEvent(new w.Event('click', { bubbles: true }));
  try {
    doc.getElementById('sqDescIn').value = phrase; w.sqAnalyze(); await wait(1500);
    const R = w.S._lastRoute, ent = R && R.entity, entityType = R && R.entityType;
    const mod = ent && (ent.intake_chain || []).map(s => s && s.module).find(m => /symptom|issue/.test(m || ''));
    const chip = [...doc.querySelectorAll('.ims-chip')].find(c => clean(c.dataset.label || c.textContent) === label);
    const out = { phrase, entity: (ent && ent.id) || (entityType === 'dynamic' ? '(dynamic fallback)' : '?'), entityType, module: mod || null, chips: doc.querySelectorAll('.ims-chip').length };
    if (!chip) { out.error = `no chip "${label}"`; return out; }
    out.engineState = ent ? w.eval(`(function(){try{var a={};a[${JSON.stringify(mod)}]=${JSON.stringify(label)};var q=_computePrice(S._lastRoute.entity,a,1);return q.checkoutStateKey}catch(e){return 'n/a'}})()`) : null;
    tap(chip); await wait(1300);
    const body = text(doc.body);
    out.fork = /On-site quote/.test(body) && /Book an on-site diagnostic/.test(body);
    const price = doc.querySelector('.summary-estimate .price-value'); out.cardPrice = price ? clean(price.textContent) : null;
    const add = doc.getElementById('btn-curated-add'); out.addButton = add ? clean(add.textContent) : null;
    out.cardMarks = [...new Set([...(add ? text(add.closest('div[class*=card],div')) : body).matchAll(/(on-site|diagnos|\(est\.\)|credited)/gi)].map(m => m[0].toLowerCase()))];
    if (add) { tap(add); await wait(1500); const sub = doc.querySelector('.cart-subtotal'); const m = body && text(doc.body).match(/Due Today:\s*\$[\d,]+/g); out.cartSubtotal = sub ? clean(sub.textContent) : null; out.dueToday = m ? m[m.length - 1] : null; const line = text(doc.body).match(/Curated intakeAnswers:[^✕]*/); out.cartLine = line ? clean(line[0]) : null; }
    return out;
  } finally { dom.window.close(); }
}

// B. the builder's "What's the issue?" chips for a group
async function builderChips(db, groups) {
  const dom = await open(db), w = dom.window; const res = {};
  try {
    const generic = (w.bldFallbackConditions() || []).map(c => c.label);
    for (const g of groups) { const ch = w.bldGetConditionChoices('fix', g); const labels = (ch || []).map(c => c.label); res[g] = { n: labels.length, generic: labels.length === generic.length && labels.every((l, i) => l === generic[i]), first: labels.slice(0, 4) }; }
    return res;
  } finally { dom.window.close(); }
}

// C. drive the Dishwasher "Something else" builder to its quote with a chosen symptom
async function builderQuote(db, answer) {
  const dom = await open(db), w = dom.window, doc = w.document, tap = el => el.dispatchEvent(new w.Event('click', { bubbles: true }));
  try {
    const nm = t => clean((t.querySelector('.tile-name') || t).textContent), tiles = () => [...doc.querySelectorAll('#serviceContainer .group-tile, #serviceContainer .service-tile, #serviceContainer .svc-tile')];
    const group = w.DB.group.find(g => g.id === 'minor_home_repairs_appliances_dishwasher'); w.S._lastRoute = null; w.showSubGroups(group, group.category_id); await wait(50);
    for (const name of ['Fix / Repair', 'Something else']) { const t = tiles().find(x => nm(x) === name); if (!t) return { error: `no tile ${name}` }; tap(t); await wait(700); }
    const b = doc.getElementById('sqBuilder');
    for (let i = 0; i < 4 && b.style.display !== 'none'; i++) {
      const chips = [...b.querySelectorAll('#sqBuilderChips .sq-b-chip')]; if (!chips.length) break;
      const prompt = clean((doc.getElementById('sqBuilderPrompt') || {}).textContent);
      const pick = /issue/i.test(prompt) ? chips.find(c => clean(c.textContent) === answer) : chips[0];
      if (!pick) return { error: `no chip "${answer}" (the builder offers ${chips.length}: ${chips.slice(0, 3).map(c => clean(c.textContent)).join(', ')} ...)` };
      tap(pick); await wait(700);
    }
    tap(doc.getElementById('sqS2next')); await wait(1500); tap(doc.getElementById('sqS3build')); await wait(1500); tap(doc.querySelector('.adlib-yes')); await wait(2000);
    const out = doc.getElementById('sqQuoteOut'), t = text(out);
    return { tag: (out.querySelector('.qitag') || {}).textContent && clean(out.querySelector('.qitag').textContent), price: (out.querySelector('.qprice') || {}).textContent && clean(out.querySelector('.qprice').textContent), urgent: /Urgent[^+]*\+\$\d+/.test(t) ? t.match(/Urgent[^+]*\+\$\d+/)[0] : null };
  } finally { dom.window.close(); }
}

(async () => {
  const after = applyBatch(DB0);
  console.log('# ' + path.relative(ROOT, FILE) + ' applied IN MEMORY to btnyc.json; qr.html loaded in jsdom. Nothing is written. Read-only probe.\n');
  console.log('## A. The same answer ("Leaking water", whose option carries checkout_state_override: diagnostic), on a service and on a fallback');
  const cases = [['washer_repair (a service; the control)', 'washer is broken'], ['the Dishwasher Repair fallback', 'dishwasher problem'], ['a second fallback (Window AC)', 'window air conditioner problem']];
  for (const [what, phrase] of cases) for (const [tag, db] of [['catalog as it is', DB0], ['with the batch  ', after]]) {
    const r = await typed(db, phrase, 'Leaking water');
    console.log(`  ${what.padEnd(40)} ${tag}  -> entity ${r.entity} [${r.entityType}], asks ${r.module} (${r.chips} answer chips on the card)`);
    if (r.error) { console.log(`      ${r.error}`); continue; }
    console.log(`      engine's own state for the answer: ${r.engineState}`);
    console.log(`      drawn: ${r.fork ? 'THE FORK ("On-site quote ... Book an on-site diagnostic")' : `a card with price ${r.cardPrice}, button "${r.addButton}", diagnostic markers on the card: ${r.cardMarks.length ? r.cardMarks.join(', ') : 'none'}`}`);
    if (r.cartSubtotal) console.log(`      after "Add to Request": cart ${r.cartSubtotal}; ${r.dueToday}; line: ${r.cartLine}`);
  }
  console.log('\n## B. The guided builder\'s "What\'s the issue?" chips (bldGetConditionChoices), per group');
  const groups = Object.keys(P.tiles.groups).concat(['minor_home_repairs_appliances', 'minor_home_repairs_appliances_other']);
  const b0 = await builderChips(DB0, groups), b1 = await builderChips(after, groups);
  for (const g of groups) {
    const a = b0[g], z = b1[g], short = g.replace('minor_home_repairs_appliances_', '').replace('minor_home_repairs_appliances', 'appliances');
    const desc = x => `${String(x.n).padStart(2)} chips${x.generic ? ' (the GENERIC fallback list)' : ''}: ${x.first.join(', ')}`;
    console.log(`  ${short.padEnd(14)} as it is: ${desc(a)}\n  ${''.padEnd(14)} with batch: ${desc(z)}${a.first.join() !== z.first.join() ? '   <-- CHANGES' : ''}`);
  }
  console.log('\n## C. The guided builder driven to its quote (Dishwasher > Fix / Repair > Something else > a symptom > 1 > Next > Construct > Calculate), catalog as it is');
  for (const a of ['Won’t spin / no movement', 'Burning smell', 'Leaking water']) { const r = await builderQuote(DB0, a); console.log(`  ${a.padEnd(28)} -> ${r.error || `${r.tag}, ${r.price}${r.urgent ? `  (includes: ${r.urgent})` : ''}`}`); }
  console.log('  The chosen symptom does not reach the price as its modifier or its checkout state: "Won\'t spin" and "Burning smell" quote the same; "Leaking water" differs only by the urgent surcharge a detected tag adds.');
  console.log('\nWhy B changes: bldGetConditionChoices looks for a chain module whose NAME is one of [symptom, issue, damage_type, state] (a literal list in qr.html). The batch re-points the chains to modules with other names.');
})();
