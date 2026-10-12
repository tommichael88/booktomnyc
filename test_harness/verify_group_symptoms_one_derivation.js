#!/usr/bin/env node
/**
 * verify_group_symptoms_one_derivation.js -- PENDING_DECISIONS #199 (T174): the symptom a customer is offered for an appliance comes from ONE place and is the question that appliance is asked.
 *
 * Before: Refrigerator, Microwave, Window AC (services) and every appliance FALLBACK (Dryer, Stove, Dishwasher, Refrigerator, Microwave, Appliances, Other, the category-level Diagnostic) asked the washer's
 * `symptom` module ("What's the issue with the appliance?": Won't spin / no movement, Won't drain). The picker's tiles were a hand-kept id list (four ids for the Dishwasher, drawn as "Wont spin"),
 * the guided builder found its chips by a literal list of module names, and a tapped tile answered nothing, so the card asked the question the customer had just answered. Three definitions of
 * "which intake module describes the condition" (D-C11-3), none of them the question the appliance was asked.
 *
 * After: a group DECLARES its symptom module (routing_archetypes[group].symptom_module). The module's options are the symptoms. The picker draws them as tiles, the builder offers them as chips
 * (resolveGroupSymptoms is the one derivation), a tap carries the option as the answer (resolveTappedAnswers), and the compiler derives the old id lists from the declaration.
 *
 *   1. DATA CONTRACT (pure, on the catalog; proven able to fail with six mutants): every symptom-first appliance group declares a module; a declared module is OWNED -- asked by that group's own service and
 *      its Repair/Diagnostic fallbacks, declared and asked by no other group, and no service or fallback of another group asks it; compiled ids and service maps are the module's; the washer's `symptom` is asked
 *      by the washer alone; every `tile: false` option is outside the tiles.
 *   2. THE PAGE: for each of the six symptom-first groups the picker's symptom tiles equal the module's offered options, in order; the builder's chips are the same labels; tapping each tile lands on the group's
 *      repair service with the option as its answer and the question is not asked again; the answer prices (a diagnostic option is the diagnostic quote); the builder's chosen chip is the answer the Repair fallback
 *      prices. The three declared groups that are not symptom-first (Appliances, Other, Window AC) offer their module's chips, not the 22 generic ones.
 *   3. TYPED PHRASES: a typed appliance phrase routes to an entity that asks its group's declared module, never another appliance's.
 *   4. ONE DEFINITION: resolveGroupSymptoms is defined once and read by the picker and by bldGetConditionChoices.
 *   5. NON-VACUITY: undeclaring a group, a picker that ignores the declaration, a tap that drops the answer and a builder that ignores the declaration each turn the matching check red.
 */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = process.env.QR_ROOT || path.resolve(__dirname, '..');
const { JSDOM } = require(path.join(__dirname, 'node_modules', 'jsdom'));
const { assemble } = require('./_page.js');
let pass = 0, fail = 0;
const check = (name, ok, detail) => { if (ok) { pass++; console.log('  ✓ ' + name); } else { fail++; console.log('  ✗ ' + name + (detail ? '\n      ' + detail : '')); } };
const clone = o => JSON.parse(JSON.stringify(o)), wait = ms => new Promise(r => setTimeout(r, ms)), clean = s => String(s || '').replace(/\s+/g, ' ').trim();
const DB0 = JSON.parse(fs.readFileSync(path.join(ROOT, 'btnyc.json'), 'utf8'));
const QR_TEXT = fs.readFileSync(path.join(ROOT, 'qr.html'), 'utf8');

const APPLIANCE_GROUPS = Object.keys(DB0.routing_archetypes).filter(g => /^minor_home_repairs_appliances/.test(g));
const OWNERS = ['washer', 'dryer', 'stove_range', 'refrigerator', 'dishwasher', 'microwave'].map(s => 'minor_home_repairs_appliances_' + s);
const USERS = ['minor_home_repairs_appliances', 'minor_home_repairs_appliances_other', 'minor_home_repairs_appliances_window_ac'];
const chainMods = e => (e.intake_chain || []).map(s => (s && s.module) || s);
const groupOfKey = k => { const p = k.split('+'); return p.length === 3 ? p[1] : null; };
const slug = label => 'sym.' + label.replace(/[’']/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

// ── 1. the data contract, as a pure function of a catalog ───────────────────────────────────────────────────────────────────────────────────────────────
function audit(db) {
  const v = [], RA = db.routing_archetypes, IM = db.intake_modules;
  const owned = {};                                            // module -> owning group
  for (const g of Object.keys(RA)) if (RA[g].symptom_module && RA[g].routing_archetype === 'symptom_first') {
    if (owned[RA[g].symptom_module]) v.push(`${g} and ${owned[RA[g].symptom_module]} both own ${RA[g].symptom_module}`); else owned[RA[g].symptom_module] = g;
  }
  for (const g of OWNERS) {
    const ra = RA[g], m = ra && ra.symptom_module;
    if (!m) { v.push(`${g}: declares no symptom_module`); continue; }
    if (!IM[m]) { v.push(`${g}: symptom_module ${m} is not an intake module`); continue; }
    const svcs = db.services.filter(s => s.ui_taxonomy.group_id === g && chainMods(s).includes(m));
    if (!svcs.length) v.push(`${g}: no service of the group asks ${m}`);
    const tiles = IM[m].client_response.filter(o => o.tile !== false);
    if (!tiles.length) v.push(`${g}: ${m} offers no tile`);
    const ids = tiles.map(o => slug(o.label));
    if (JSON.stringify([...ra.real_symptom_ids].sort()) !== JSON.stringify([...ids].sort())) v.push(`${g}: real_symptom_ids are not the compiled tile ids of ${m}`);
    for (const id of ids) if (JSON.stringify(ra.symptom_id_to_service_ids[id]) !== JSON.stringify(svcs.map(s => s.id).sort())) v.push(`${g}: ${id} does not map to the services that ask ${m}`);
    for (const o of IM[m].client_response.filter(o => o.tile === false)) if (ids.includes(slug(o.label))) v.push(`${g}: "${o.label}" is tile:false and is a tile`);
    for (const st of ['Repair', 'Diagnostic']) {
      const key = 'minor_home_repairs+' + g + '+' + st;
      if (db.dynamic_services[key] && !chainMods(db.dynamic_services[key]).includes(m)) v.push(`${key}: does not ask ${g}'s ${m} (asks ${chainMods(db.dynamic_services[key]).join(',')})`);
    }
  }
  for (const g of USERS) {
    const m = RA[g] && RA[g].symptom_module;
    if (!m || !IM[m]) { v.push(`${g}: declares no usable symptom_module`); continue; }
    if (owned[m]) v.push(`${g}: uses ${m}, which ${owned[m]} owns`);
  }
  // an owned module is asked by nothing outside its owner
  for (const [m, g] of Object.entries(owned)) {
    for (const s of db.services) if (s.ui_taxonomy.group_id !== g && chainMods(s).includes(m)) v.push(`service ${s.id} (${s.ui_taxonomy.group_id}) asks ${m}, owned by ${g}`);
    for (const [k, d] of Object.entries(db.dynamic_services)) if (groupOfKey(k) !== g && chainMods(d).includes(m)) v.push(`fallback ${k} asks ${m}, owned by ${g}`);
  }
  // the original defect: the washer's question asked of other appliances
  for (const s of db.services) if (/^minor_home_repairs_appliances/.test(s.ui_taxonomy.group_id) && s.ui_taxonomy.group_id !== OWNERS[0] && chainMods(s).includes('symptom')) v.push(`appliance service ${s.id} asks the washer's symptom`);
  for (const [k, d] of Object.entries(db.dynamic_services)) if ((/minor_home_repairs_appliances/.test(k) || /^minor_home_repairs\+(Repair|Diagnostic)$/.test(k)) && groupOfKey(k) !== OWNERS[0] && chainMods(d).includes('symptom')) v.push(`appliance fallback ${k} asks the washer's symptom`);
  return v;
}

// ── 2. the page ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
async function openPage(html, db) {
  const dom = new JSDOM(html, { url: 'https://tommichael88.github.io/booktomnyc/qr.html', runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true, beforeParse(w) {
    w.fetch = async u => String(u).includes('btnyc.json') ? { ok: true, json: async () => clone(db) } : { ok: false, status: 404 };
    w.HTMLElement.prototype.scrollIntoView = function () {}; w.console.log = () => {}; w.console.warn = () => {}; w.console.error = () => {};
  } });
  for (let i = 0; i < 60 && !(dom.window.DB && dom.window.renderRoute && dom.window.bldGetConditionChoices); i++) await wait(100);
  return dom;
}
const tapOn = (w, el) => el.dispatchEvent(new w.Event('click', { bubbles: true }));

async function pickerLeg(html, db, groups) {
  const out = { tiles: [], taps: [], tapN: 0, errors: [] };
  for (const gid of groups) {
    const ra = db.routing_archetypes[gid], m = ra.symptom_module, mod = db.intake_modules[m], group = db.group.find(g => g.id === gid);
    const want = mod.client_response.filter(o => o.tile !== false).map(o => o.label);
    const svcIds = db.services.filter(s => s.ui_taxonomy.group_id === gid && chainMods(s).includes(m)).map(s => s.id);
    const draw = async () => { const dom = await openPage(html, db), w = dom.window, doc = w.document, c = doc.getElementById('serviceContainer') || doc.body;
      w.renderComponentSymptomPicker(c, group, group.category_id, 'Repair'); return { dom, w, doc, c, tiles: [...c.querySelectorAll('.group-tile')] }; };
    try {
      const first = await draw(), names = first.tiles.map(t => clean(t.querySelector('.tile-name').textContent));
      const symptomTiles = names.slice(0, want.length);
      if (JSON.stringify(symptomTiles) !== JSON.stringify(want.map(clean))) out.tiles.push(`${gid}: tiles ${JSON.stringify(symptomTiles)} vs the module's ${JSON.stringify(want)}`);
      first.dom.window.close();
      for (let i = 0; i < want.length; i++) {
        out.tapN++;
        const P = await draw(), w = P.w, doc = P.doc; tapOn(w, P.tiles[i]); await wait(700);
        const R = w.S._lastRoute, bad = [], opt = mod.client_response.find(o => clean(o.label) === clean(want[i]));
        if (!R || !R.entity) { bad.push('no route'); }
        else {
          if (!svcIds.includes(R.entity.id)) bad.push('landed on ' + R.entity.id + ', not one of ' + svcIds.join(','));
          if (R.answers[m] !== opt.label) bad.push('answer ' + JSON.stringify(R.answers[m]) + ' not carried');
          const drawn = [...doc.querySelectorAll('.ims-chip')].filter(c => c.dataset.mod === m);
          if (drawn.length && !drawn.some(c => clean(c.dataset.label) === clean(opt.label) && c.classList.contains('sel'))) bad.push('the question is drawn without the tapped answer selected');
          if (drawn.length && drawn.some(c => c.classList.contains('sel') && clean(c.dataset.label) !== clean(opt.label))) bad.push('a different answer is selected');
          const stat = R.entity.financial_engine && R.entity.financial_engine.checkout_state === 'diagnostic';
          const wantState = (stat || opt.checkout_state_override === 'diagnostic') ? 'diagnostic' : null;
          if (wantState && R.quote.checkoutStateKey !== 'diagnostic') bad.push('a diagnostic option quoted ' + R.quote.checkoutStateKey);
          if (!wantState && R.quote.checkoutStateKey === 'diagnostic') bad.push('a non-diagnostic option quoted diagnostic');
        }
        if (bad.length) out.taps.push(`${gid} + "${want[i]}": ${bad.join('; ')}`);
        P.dom.window.close();
      }
    } catch (e) { out.errors.push(gid + ': ' + e.message); }
  }
  return out;
}

async function chipsLeg(html, db, groups, opts) {
  const ref = (opts && opts.expectFrom) || db; // the catalog whose declarations say what the chips SHOULD be
  const out = { chips: [], builder: [], builderN: 0, errors: [] };
  const dom = await openPage(html, db), w = dom.window;
  for (const gid of groups) {
    try {
      const m = ref.routing_archetypes[gid].symptom_module, want = ref.intake_modules[m].client_response.filter(o => o.tile !== false).map(o => o.label);
      const chips = w.bldGetConditionChoices('fix', gid), got = (chips || []).map(c => c.label);
      if (JSON.stringify(got) !== JSON.stringify(want)) out.chips.push(`${gid}: chips ${JSON.stringify(got).slice(0, 140)} vs ${m}'s ${JSON.stringify(want).slice(0, 140)}`);
    } catch (e) { out.errors.push(gid + ': ' + e.message); }
  }
  // the chosen chip is the answer the Repair fallback prices (every owner group: the diagnostic option and a plain one where the module has both)
  for (const gid of OWNERS) {
    const m = db.routing_archetypes[gid].symptom_module; if (!m) continue; // a mutant catalog that undeclares a group has nothing to price through
    const key = 'minor_home_repairs+' + gid + '+Repair', d = db.dynamic_services[key];
    if (!d) continue;
    const opts = db.intake_modules[m].client_response.filter(o => o.tile !== false);
    const picks = [opts.find(o => o.checkout_state_override === 'diagnostic'), opts.find(o => o.checkout_state_override !== 'diagnostic')].filter(Boolean);
    for (const o of picks) {
      out.builderN++;
      try {
        w.sqRestart();
        w.eval('BLD.action="fix"; BLD.object=' + JSON.stringify(gid) + '; BLD.specific=' + JSON.stringify(gid) + '; BLD._groupId=' + JSON.stringify(gid) + '; BLD._cat="minor_home_repairs"; BLD._stype="Repair"; BLD._keyword=bldGroupToKeyword(' + JSON.stringify(gid) + ', "minor_home_repairs"); BLD.condition=' + JSON.stringify(o.label.toLowerCase()) + '; BLD.qty=1;');
        w.sqBuilderFinish(); w.sqConfirmAdlib();
        const q = w.computeQuoteFromState(w.S), bad = [];
        if (w.S.answers[m] !== o.label) bad.push('answer not carried (' + JSON.stringify(w.S.answers) + ')');
        if ((q.checkoutStateKey === 'diagnostic') !== (o.checkout_state_override === 'diagnostic')) bad.push('state ' + q.checkoutStateKey);
        if (bad.length) out.builder.push(`${key} + "${o.label}": ${bad.join('; ')}`);
      } catch (e) { out.builder.push(`${key} + "${o.label}": ${e.message}`); }
    }
  }
  dom.window.close();
  return out;
}

// ── 3. typed phrases, through the real orchestrator ─────────────────────────────────────────────────────────────────────────────────────────────────
function typedLeg(db) {
  const sb = { DB: db, SERVICE_DATA: db, window: { DB: db }, console: { log() {}, warn() {}, error() {}, info() {}, debug() {} } }; sb.global = sb; vm.createContext(sb);
  for (const f of ['pricing_engine.js', 'nlp_engine.js', 'orchestrator_engine.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sb, { filename: f });
  const phrases = ['my fridge is not cooling', 'refrigerator leaking water', 'fridge making a weird noise', 'fix my fridge', 'microwave not heating', 'microwave sparking', 'microwave turntable stuck', 'fix my microwave',
    'window ac not cooling', 'window ac wont turn on', 'window air conditioner leaking', 'dishwasher not draining', 'dishwasher leaking', 'dryer not heating', 'dryer wont turn on', 'fix my dryer',
    'oven not heating', 'fix my stove', 'washer wont spin', 'washer leaking', 'fix my washer', 'appliance not working', 'my appliance is broken'];
  const out = { routed: 0, wrong: [], unrouted: [] };
  for (const p of phrases) {
    try {
      const R = sb.executeWorkflow(sb.collectBookingContext_freeText(p), db), e = R.entity;
      const gid = e ? (R.entityType === 'service' ? e.ui_taxonomy.group_id : (R.resolution && R.resolution.groupId) || null) : null;
      const chain = (R.intakeChain || []).map(m => m.moduleKey || m.module);
      // the group is whichever appliance group the entity belongs to: a service by its taxonomy, a fallback by the key it was found under
      const key = R.entityType === 'dynamic' ? Object.keys(db.dynamic_services).find(k => db.dynamic_services[k] === e || JSON.stringify(db.dynamic_services[k]) === JSON.stringify(e)) : null;
      const g = gid || (key ? groupOfKey(key) : null);
      const owned = Object.fromEntries(OWNERS.map(o => [db.routing_archetypes[o].symptom_module, o]));
      const foreign = chain.filter(m => owned[m] && owned[m] !== g);
      if (!e) { out.unrouted.push(p); continue; }
      out.routed++;
      if (foreign.length) out.wrong.push(`"${p}" -> ${R.entityType}:${e.id || key} (group ${g}) asks ${foreign.join(',')}, owned by ${foreign.map(f => owned[f]).join(',')}`);
      else if (g && db.routing_archetypes[g] && db.routing_archetypes[g].symptom_module && /appliances/.test(g) && !chain.includes(db.routing_archetypes[g].symptom_module) && chain.some(m => /symptom|window_ac_issue/.test(m))) out.wrong.push(`"${p}" -> ${g} asks ${chain.join(',')}, not its ${db.routing_archetypes[g].symptom_module}`);
    } catch (err) { out.wrong.push(`"${p}": ${err.message}`); }
  }
  return out;
}

function mutantHtml(label, fn) {
  const mutated = fn(QR_TEXT);
  check('mutant "' + label + '" changed the page source', mutated !== QR_TEXT);
  return assemble(mutated, ROOT);
}

(async () => {
  console.log('\n=== 1. data contract ===');
  const base = audit(DB0);
  check('every symptom-first appliance group declares a module it owns; no other group declares or asks it; ids and maps compiled from it -- violations: ' + base.length, base.length === 0, base.slice(0, 8).join(' | '));
  check('population: the six owners are symptom-first, and the three users are declared', OWNERS.every(g => DB0.routing_archetypes[g].routing_archetype === 'symptom_first') && USERS.length === 3);
  { const c = () => clone(DB0);
    const m1 = c(); m1.dynamic_services['minor_home_repairs+minor_home_repairs_appliances_refrigerator+Repair'].intake_chain.find(s => s.module === 'refrigerator_symptom').module = 'symptom';
    check('MUTANT: a fallback pointed back at the washer\'s question is caught', audit(m1).some(x => /asks the washer's symptom|does not ask/.test(x)));
    const m2 = c(); m2.routing_archetypes.minor_home_repairs_appliances_dishwasher.real_symptom_ids = ['sym.leaking_water', 'sym.strange_noises', 'sym.wont_drain', 'sym.wont_spin'];
    check('MUTANT: a hand-kept symptom id list that drifts from the module is caught', audit(m2).some(x => /real_symptom_ids are not the compiled tile ids/.test(x)));
    const m3 = c(); delete m3.routing_archetypes.minor_home_repairs_appliances_dryer.symptom_module;
    check('MUTANT: a group that stops declaring its module is caught', audit(m3).some(x => /declares no symptom_module/.test(x)));
    const m4 = c(); m4.routing_archetypes.minor_home_repairs_appliances_stove_range.symptom_module = 'dryer_symptom';
    check('MUTANT: two groups owning one module is caught', audit(m4).some(x => /both own/.test(x)));
    const m5 = c(); m5.services.find(s => s.id === 'microwave_repair').intake_chain.find(s => s.module === 'microwave_symptom').module = 'dryer_symptom';
    check('MUTANT: a service asking another appliance\'s question is caught', audit(m5).some(x => /asks dryer_symptom, owned by/.test(x)));
    const m6 = c(); m6.intake_modules.dishwasher_symptom.client_response.find(o => o.tile === false).tile = true;
    check('MUTANT: an "Other" that becomes a tile without its id is caught', audit(m6).some(x => /real_symptom_ids are not the compiled tile ids/.test(x))); }

  const HTML = assemble(QR_TEXT, ROOT);
  console.log('\n=== 2. the page: tiles, chips, taps ===');
  const P = await pickerLeg(HTML, DB0, OWNERS);
  check('no group failed to draw -- errors: ' + P.errors.length, P.errors.length === 0, P.errors.join(' | '));
  check('each group\'s picker draws its module\'s offered options as its first tiles, in order (' + OWNERS.length + ' groups) -- violations: ' + P.tiles.length, P.tiles.length === 0, P.tiles.join(' | '));
  check('every tile lands on the group\'s repair service with the option as the answer, the question is not asked again, and it prices as that answer (' + P.tapN + ' taps) -- violations: ' + P.taps.length, P.tapN >= 30 && P.taps.length === 0, P.taps.slice(0, 6).join(' | '));
  const C = await chipsLeg(HTML, DB0, OWNERS.concat(USERS));
  check('no chip check errored -- errors: ' + C.errors.length, C.errors.length === 0, C.errors.join(' | '));
  check('the builder offers each declared group\'s module options as its chips (' + (OWNERS.length + USERS.length) + ' groups, none of the 22 generic ones) -- violations: ' + C.chips.length, C.chips.length === 0, C.chips.join(' | '));
  check('the builder\'s chosen chip is the answer the Repair fallback prices: carried, and a diagnostic option is the diagnostic quote (' + C.builderN + ' cases) -- violations: ' + C.builder.length, C.builderN >= 10 && C.builder.length === 0, C.builder.slice(0, 6).join(' | '));

  console.log('\n=== 3. typed phrases ===');
  const T = typedLeg(DB0);
  check('every typed appliance phrase routes to an entity that asks its own group\'s question and no other appliance\'s (' + T.routed + ' routed) -- violations: ' + T.wrong.length, T.routed >= 18 && T.wrong.length === 0, T.wrong.join(' | ') + (T.unrouted.length ? ' ; unrouted: ' + T.unrouted.join(', ') : ''));

  console.log('\n=== 4. one definition ===');
  { const defs = (QR_TEXT.match(/function resolveGroupSymptoms\(/g) || []).length;
    check('resolveGroupSymptoms is defined exactly once', defs === 1, 'definitions: ' + defs);
    check('the picker reads it', /function renderComponentSymptomPicker[\s\S]*?resolveGroupSymptoms\(group\.id, DB\)/.test(QR_TEXT));
    check('bldGetConditionChoices reads it before any module name is looked at', /function bldGetConditionChoices[\s\S]*?resolveGroupSymptoms\(groupId, DB\)[\s\S]*?\['symptom', 'issue', 'damage_type', 'state'\]/.test(QR_TEXT));
    check('a tapped answer reaches the booking context through resolveTappedAnswers, and nowhere else', (QR_TEXT.match(/resolveTappedAnswers\(/g) || []).length === 2 && /function collectBookingContext_catalog[\s\S]*?answers: resolveTappedAnswers\(svc, tapped, DB\)/.test(QR_TEXT)); }

  console.log('\n=== 5. non-vacuity: a break in the page or the data fails the check that guards it ===');
  { const db = clone(DB0), g = 'minor_home_repairs_appliances_dryer'; delete db.routing_archetypes[g].symptom_module;
    const c = await chipsLeg(HTML, db, [g], { expectFrom: DB0 });
    check('  -> a group that declares nothing: the builder\'s chips are no longer its module\'s (' + c.chips.length + ' of 1 groups)', c.chips.length === 1); }
  { const h = mutantHtml('the picker ignores the declaration', src => src.replace("const declaredSymptoms = isSymptomFirst ? resolveGroupSymptoms(group.id, DB) : null;", 'const declaredSymptoms = null;'));
    const r = await pickerLeg(h, DB0, ['minor_home_repairs_appliances_dishwasher', 'minor_home_repairs_appliances_microwave']);
    check('  -> the tiles are the hand-kept ids again, and the check names both groups (' + r.tiles.length + ' of 2)', r.tiles.length === 2); }
  { const h = mutantHtml('a tap drops its answer', src => src.replace('{ tagIds: entry.tagIds, answers: entry.answers }', '{ tagIds: entry.tagIds }'));
    const r = await pickerLeg(h, DB0, ['minor_home_repairs_appliances_refrigerator']);
    check('  -> the card asks the question again, and the check names every tap (' + r.taps.length + ' of 6)', r.taps.length === 6); }
  { const h = mutantHtml('the builder ignores the declaration', src => src.replace('const declared = groupId ? resolveGroupSymptoms(groupId, DB) : null;', 'const declared = null;'));
    const c = await chipsLeg(h, DB0, OWNERS.concat(USERS));
    check('  -> the chips fall back to the legacy discovery for every group that has left it (' + c.chips.length + ' of ' + (OWNERS.length + USERS.length) + ' groups; at least the five whose module is not in the literal list)', c.chips.length >= 8); }

  console.log(`\n[group symptoms: one derivation] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
  process.exit(fail ? 1 : 0);
})();
