/**
 * verify_offering_activation_contract.js -- T198 (AA): a service authored LATER reaches every consumer through the catalog alone, and an authored "not offered" verb stops being declined the moment the catalog
 * offers it. No code, rule list or phrase table is edited: the fixture below is data only (a mapped action, a service type, a service, a group, an object, an entity), and removing it restores the decline.
 *   A. SHIPPED     painting is declined from the authored offering on the verb (no price).
 *   B. ACTIVATED   data-only painting service: free text routes and prices it (no decline), the guided builder offers a Paint action derived from the authored service type, the catalog browser has its group,
 *                  a hazard still stops first (a new service cannot bypass a safety policy), and the noun "painting" (hang a painting) is not captured.
 *   C. REMOVED     the activation is withdrawn (the shipped catalog) and the decline returns.
 *   D. VALIDATION  a source that authors the verb as both offered and not offered fails V-OFFER-SHADOW with an actionable message.
 */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), { execSync } = require('child_process');
const PAGE = require('./_page.js');
const ROOT = process.env.QR_ROOT || path.resolve(__dirname, '..');
let pass = 0, fail = 0;
const check = (name, ok, detail) => { if (ok) { pass++; console.log('  ✓ ' + name); } else { fail++; console.log('  ✗ ' + name + (detail ? '\n      ' + String(detail).split('\n').join('\n      ') : '')); } };
function findChrome() { const c = [process.env.CHROME_PATH, ...(() => { try { return execSync('find /home/*/.cache/puppeteer /root/.cache/puppeteer -type f -name chrome 2>/dev/null || true', { shell: '/bin/bash' }).toString().trim().split('\n').filter(Boolean); } catch { return []; } })(), '/usr/bin/google-chrome', '/usr/bin/chromium-browser', '/usr/bin/chromium'].filter(Boolean); return c.find(p => fs.existsSync(p)) || null; }
const sleep = ms => new Promise(r => setTimeout(r, ms));
const HTML = path.join(ROOT, 'qr.html'), DATA = fs.readFileSync(path.join(ROOT, 'btnyc.json'), 'utf8');
const { engine } = require('./_engine.js');

// The whole activation, as data. Moving "paint" from the not-offered verbs to a mapped action is the authored act; everything else is what any new service needs.
function activate(DB) {
    delete DB.negation_library.action_conjugations._extra_actions_not_tied_to_service_type.paint;
    DB.service_types.Paint = Object.assign({}, DB.service_types.Install, { verb_natural: 'painted', ui_badge_label: 'Painting' });
    DB.negation_library.action_conjugations.Paint = { infinitive_for_adlib: 'paint', all_forms: ['paint', 'paints', 'painted', 'painting the', 'painting my', 'paint job', 'painter'], synonym_clusters: [{ infinitive: 'repaint', forms: ['repaint', 'repaints', 'repainted', 'repainting'] }] };
    const svc = JSON.parse(JSON.stringify(DB.services.find(s => s.id === 'blinds_shades_curtains_buy_the_hour')));
    Object.assign(svc, { id: 'painting_walls_buy_the_hour', charter_id: 'svc.painting_walls_buy_the_hour', entity_id: 'ent.painting' });
    Object.assign(svc.ui_taxonomy, { group_id: 'wall_painting', display_name: 'Wall Painting ⏰ Buy-the-Hour', description: 'Paint walls, ceilings and trim.', naming: { object: 'Wall Painting', actions: ['paint'], tail: 'buy_the_hour', name: 'Wall Painting' }, icon: '🎨' });
    svc.financial_engine.base_price = 60; svc.intake_chain = [{ module: 'buy_the_hour_qty', then: {} }]; svc.required_materials = []; svc.optional_materials = []; svc.default_tags = []; DB.services.push(svc);
    DB.group.push({ id: 'wall_painting', charter_id: 'grp.wall_painting', category_id: 'wall_mounting', parent_group: null, display_name: 'Wall Painting ⏰ Buy-the-Hour', icon: '🎨', explicit_services: ['painting_walls_buy_the_hour'], dynamic_service_types: [] });
    DB.intent_mappings.objects.push({ keyword: 'paint', synonyms: ['paint', 'repaint', 'repainting', 'painter', 'paint the walls', 'paint walls'], default_dynamic_category: 'wall_mounting', default_service_sku: 'painting_walls_buy_the_hour', confidence_weight: 70, default_service_type: 'Paint', full_weight_synonyms: ['paint', 'repaint', 'repainting'] });
    // The author also states that the NOUN "painting" is an artwork to hang (as the catalog already does for "mirror"): the verb and the noun share a stem, and which one a word is stays an authored fact, not an engine rule.
    DB.intent_mappings.objects.push({ keyword: 'painting', synonyms: ['painting', 'paintings'], default_dynamic_category: 'wall_mounting', default_service_sku: 'shelf_mounting_standard_buy_the_hour', default_service_type: 'Mount', confidence_weight: 80, full_weight_synonyms: ['painting', 'paintings'] });
    DB.entities.push({ id: 'ent.painting', label: 'Wall Painting', kind: 'component', parent_id: null, aliases: ['paint', 'repaint'], question_ids: ['q.buy_the_hour_qty'], service_ids: ['svc.painting_walls_buy_the_hour'], composition_ids: [], uncertainty_classes: [] });
}
function load(mutate) {
    const DB = JSON.parse(DATA); if (mutate) mutate(DB); const w = engine();
    const sb = { DB, SERVICE_DATA: DB, window: { DB }, console: { log() {}, warn() {}, error() {}, info() {}, debug() {} } }; sb.global = sb; vm.createContext(sb);
    vm.runInContext(w.wrapper, sb); if (typeof sb.initNlpSets === 'function') sb.initNlpSets(); return sb;
}
const route = (sb, t) => sb.executeWorkflow(Object.assign({}, sb.collectBookingContext_freeText(t), { tagsAffirmed: true }), sb.DB);
const ASK = ['paint my bedroom', 'repaint the ceiling', 'paint the walls light gray'];

console.log('A. shipped catalog');
const S = load();
for (const t of ASK) { const r = route(S, t); check(`A1 "${t}" is declined from the authored offering`, r.unsupportedTrade && r.unsupportedTrade.id === 'paint' && r.unsupportedTrade.mode === 'answer' && !(r.entity && /paint/.test(r.entity.id)), JSON.stringify([r.unsupportedTrade && r.unsupportedTrade.mode, r.entity && r.entity.id])); }

console.log('B. activated by data only');
const A = load(activate);
for (const t of ASK) { const r = route(A, t); check(`B1 "${t}" routes to the new service at its authored price and is not declined`, !r.unsupportedTrade && r.entity && r.entity.id === 'painting_walls_buy_the_hour' && r.basePrice === 60 && r.requestedAction === 'Paint', JSON.stringify([r.unsupportedTrade, r.entity && r.entity.id, r.basePrice, r.requestedAction])); }
{ const r = route(A, 'I smell gas, paint the room'); check('B2 a gas hazard still stops first when the service exists (a new service cannot bypass a safety policy)', !!r.safetyStop, JSON.stringify([r.safetyStop && r.safetyStop.id])); }
{ const r = route(A, 'hang a painting'); check('B3 the noun "hang a painting" is not captured by the new service', !(r.entity && r.entity.id === 'painting_walls_buy_the_hour') && !r.unsupportedTrade, JSON.stringify([r.entity && r.entity.id])); }
check('B4 the catalog browser has the new group', A.DB.group.some(g => g.id === 'wall_painting' && g.explicit_services.includes('painting_walls_buy_the_hour')));

console.log('C. removed again');
const R = load();
for (const t of ASK) { const r = route(R, t); check(`C1 "${t}" is declined again`, r.unsupportedTrade && r.unsupportedTrade.mode === 'answer', JSON.stringify(r.unsupportedTrade && r.unsupportedTrade.mode)); }

console.log('F. replace is authored (act.replace), not coded');
for (const [t, id, price] of [['replace the faucet', 'faucet_repair_drip', 50], ['replace a light fixture', 'light_fixture_replacement', 60], ['replace the toilet seat', 'toilet_seat_replacement', 35], ['change out the door handle', 'door_lock_or_handle_install', 50]]) {
    const r = route(S, t); check(`F1 "${t}" keeps its service and price ($${price}) and now carries the customer's own action (Replace)`, r.requestedAction === 'Replace' && r.entity && r.entity.id === id && r.basePrice === price, JSON.stringify([r.requestedAction, r.entity && r.entity.id, r.basePrice]));
}
check('F2 Replace is an authored service type with its conjugation (data only)', !!S.DB.service_types.Replace && !!S.DB.negation_library.action_conjugations.Replace && !S.DB.negation_library.action_conjugations._extra_actions_not_tied_to_service_type.replace);

console.log('D. validation');
{
    const V = require(path.join(ROOT, 'test_harness/tools/entity_first/validate_source.js'));
    const src = JSON.parse(fs.readFileSync(path.join(ROOT, 'ssot/btnyc_source.json'), 'utf8'));
    const ok = V.validateFull(src); check('D1 the shipped source validates', ok.ok, JSON.stringify(ok.errors.slice(0, 2)));
    const bad = JSON.parse(JSON.stringify(src)); const acts = bad.vocabulary.action_vocabulary.actions; const first = Array.isArray(acts) ? acts[0] : Object.values(acts)[0];
    const forms = first.all_forms || first.forms || (first.all_forms = []); forms.push('paint');
    const r = V.validateFull(bad); const e = r.errors.find(x => x.code === 'V-OFFER-SHADOW');
    check('D2 authoring "paint" as both offered and not offered fails V-OFFER-SHADOW with a message that names the verb', !r.ok && e && /paint/i.test(e.message || JSON.stringify(e)), JSON.stringify(r.errors.slice(0, 2)));
}

(async () => {
    let puppeteer = null; try { puppeteer = require('puppeteer-core'); } catch { /* below */ }
    const chromePath = findChrome();
    if (!chromePath || !puppeteer) { check('a browser is required', false, 'No Chrome or puppeteer-core. This test FAILS rather than skipping (DEFECT-SILENT-SKIP).'); console.log(`\n[offering activation] ${pass} passed, ${fail} failed (of ${pass + fail} checks)`); process.exit(1); }
    const activatedJson = (() => { const DB = JSON.parse(DATA); activate(DB); return JSON.stringify(DB); })();
    const browser = await puppeteer.launch({ headless: 'new', executablePath: chromePath, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const open = async body => {
        const page = await browser.newPage(); const errors = new Set();
        await page.setViewport({ width: 1280, height: 2400 }); await page.setRequestInterception(true);
        page.on('request', r => { const d = PAGE.documentResponse(r.url()); if (d) return r.respond(d); r.url().includes('btnyc.json') ? r.respond({ status: 200, contentType: 'application/json', body }) : r.continue(); });
        page.on('pageerror', e => errors.add(String(e.message).slice(0, 140)));
        await page.goto('file://' + HTML, { waitUntil: 'networkidle0', timeout: 60000 }); await page.waitForFunction(() => window.DB && window.DB.services, { timeout: 20000 });
        return { page, errors };
    };
    const type = async (page, say) => { await page.evaluate(() => { try { sqRestart(); } catch (e) {} document.getElementById('sqDescIn').value = ''; }); await page.click('#sqDescIn'); await page.type('#sqDescIn', say, { delay: 2 }); await page.click('#sqUnifiedActionBtn'); await sleep(1300); };
    const text = page => page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
    console.log('E. the page');
    const on = await open(activatedJson);
    const acts = await on.page.evaluate(() => bldActionMap().map(a => a.stype));
    check('E1 the guided builder offers a Paint action derived from the authored service type (no builder edit)', acts.includes('Paint'), JSON.stringify(acts));
    check('E2 the builder still has its existing actions', ['Install', 'Repair'].every(s => acts.includes(s)), JSON.stringify(acts));
    await type(on.page, 'paint my bedroom'); const t1 = await text(on.page);
    check('E3 typed into the free-text bar, the activated service shows a price and no decline', /\$\s?60/.test(t1) && !/isn't something we offer/i.test(t1) && !/legacy flow/i.test(t1) && on.errors.size === 0, [...on.errors].join('; ') + ' || ' + t1.slice(0, 240));
    await on.page.close();
    const off = await open(JSON.stringify(JSON.parse(DATA)));
    const acts0 = await off.page.evaluate(() => bldActionMap().map(a => a.stype));
    check('E4 shipped catalog: no Paint builder action, and Replace is offered (the authored act.replace)', !acts0.includes('Paint') && acts0.includes('Replace'), JSON.stringify(acts0));
    await type(off.page, 'paint my bedroom'); const t0 = await text(off.page);
    check('E5 shipped catalog: the page declines painting with no price', /painting isn't something we offer/i.test(t0) && off.errors.size === 0, t0.slice(0, 240));
    await browser.close();
    console.log(`\n[offering activation] ${pass} passed, ${fail} failed (of ${pass + fail} checks)`); process.exit(fail ? 1 : 0);
})();
