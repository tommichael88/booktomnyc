#!/usr/bin/env node
/**
 * verify_adlib_phrases_live_in_ssot.js
 *
 * @enforces R-SYSTEM-NODATA, R-INVARIANT-SINGLEDEF
 *
 * WHAT THIS PROVES (PHASE_PLAN.md Phase A, C-09). The interactive ad-lib sentence (`sqBuildAdlib`, "I need 1 Angle Stop replaced · ... and ... · in my bedroom
 * Surcharges: ...") speaks five fixed phrases: the opening ("I need"), the scope separator ("·"), the answer joiner ("and"), the location prefix ("in my") and the
 * surcharge strip's label ("Surcharges:"). They are business wording, so they live in the SSOT (`adlib_phrase_overrides.adlib`) and the request-sentence composer
 * (`composeAdlibParts`) already reads them from there. `sqBuildAdlib` used to carry them as literals, and read two of them from a path that does not exist
 * (`ui_config.adlib`), so editing the SSOT changed one sentence and not the other. This test builds a COUNTERFACTUAL WORLD in which every one of the five is changed in
 * the data, renders the real page in jsdom, and asserts the sentence follows the data and none of the old words survive; then it re-introduces the defect in the source
 * (the config read as `{}`) and asserts that the same check catches it. A check that cannot fail proves nothing (R-INVARIANT-PREFIX): this file was run against the
 * pre-change source first and was red there.
 *
 * It reads only each pill's VISIBLE label span (a pill also holds a hidden <select> whose options would pollute a plain textContent read; see
 * verify_adlib_noun_redundancy.js).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { JSDOM } = require(path.join(__dirname, 'node_modules', 'jsdom'));

const REPO_ROOT = path.dirname(__dirname);
const QR = process.env.QR_HTML || path.join(REPO_ROOT, 'qr.html');
const HTML = fs.readFileSync(QR, 'utf8');
const BASE = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'btnyc.json'), 'utf8'));

let pass = 0, fail = 0;
function check(label, cond, detail) {
  if (cond) { pass++; console.log('  ✓ ' + label); }
  else { fail++; console.log('  ✗ ' + label + (detail ? '\n      ' + detail : '')); }
}
const wait = ms => new Promise(r => setTimeout(r, ms));

function world({ mutateDb, mutateHtml } = {}) {
  const DB = JSON.parse(JSON.stringify(BASE)); if (mutateDb) mutateDb(DB);
  let html = HTML; if (mutateHtml) html = mutateHtml(html);
  return new JSDOM(html, {
    url: 'https://tommichael88.github.io/booktomnyc/qr.html', runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true,
    beforeParse(w) {
      w.fetch = async u => (String(u).includes('btnyc.json') ? { ok: true, json: async () => DB } : { ok: false, status: 404 });
      w.HTMLElement.prototype.scrollIntoView = function () {};
    },
  });
}

// A service with two visible, answerable, non-quantity questions: the sentence then shows answers joined by the joiner. Chosen from the data, not hardcoded.
const QTY = new Set(['item_count', 'count', 'hybrid_qty', 'global_quantity', 'item_count_template']);
const svc = BASE.services.find(s => (s.intake_chain || []).map(m => m.module).filter(m => !QTY.has(m) && BASE.intake_modules[m] && (BASE.intake_modules[m].client_response || []).length).length >= 2);
const mods = svc.intake_chain.map(m => m.module).filter(m => !QTY.has(m) && BASE.intake_modules[m] && (BASE.intake_modules[m].client_response || []).length);
const cat = svc.ui_taxonomy.category_id, grp = svc.ui_taxonomy.group_id;

async function render(opts) {
  const dom = world(opts); await wait(2500); const w = dom.window;
  const valid = Object.keys(BASE.smart_tags).filter(t => w.tagValidForCategory(t, cat, grp));
  const logistic = valid.find(t => w.isLogisticTag(t)), scope = valid.find(t => !w.isLogisticTag(t));
  const ans = {}; mods.slice(0, 2).forEach(m => { ans[m] = BASE.intake_modules[m].client_response[0].label; });
  w.eval(`S._svc=${JSON.stringify(svc)};S.svc=S._svc;S.intent={key:'x',label:${JSON.stringify(svc.ui_taxonomy.display_name)},category:${JSON.stringify(cat)}};S.stype='Repair';S._objectNoun=null;` +
    `S.detTagIds=[];S.manTagIds=${JSON.stringify([scope, logistic].filter(Boolean))};S.negatedTagIds=[];S.qty=1;S.answers=${JSON.stringify(ans)};S._location='bedroom';`);
  w.sqBuildAdlib(); await wait(50);
  const d = w.document, sent = d.getElementById('sqAdlibSentence');
  const words = [...sent.children].map(c => (c.classList.contains('adlib-pill') ? (c.querySelector('span') || {}).textContent : c.textContent) || '');
  const note = d.getElementById('sqAdlibLogisticNote');
  const out = { words, text: words.join(' | '), strip: note ? note.textContent.replace(/\s+/g, ' ').trim() : '', hasScope: !!scope, hasLogistic: !!logistic };
  dom.window.close(); return out;
}

const CFG = BASE.adlib_phrase_overrides.adlib;
const NEW = { sentence_start: 'We shall need', scope_separator: '••', answer_joiner: 'plus', location_prefix: 'at my', logistic_strip_label: 'Extra fees:' };
const OLD_WORDS = [CFG.sentence_start, CFG.scope_separator, CFG.answer_joiner, CFG.location_prefix, CFG.logistic_strip_label];

(async () => {
  check('the fixture service has two answerable questions, a scope tag and a logistic tag available (the sentence exercises all five phrases)', !!svc && mods.length >= 2, 'service: ' + (svc && svc.id));

  console.log('\n=== 1. the real world: the sentence speaks the SSOT\'s own five phrases ===');
  const real = await render();
  check('both a scope tag and a logistic tag were applicable to the fixture', real.hasScope && real.hasLogistic);
  check(`opens with the SSOT's sentence_start ("${CFG.sentence_start}")`, real.words[0] === CFG.sentence_start, real.text);
  check(`separates scope conditions with the SSOT's scope_separator ("${CFG.scope_separator}")`, real.words.includes(CFG.scope_separator), real.text);
  check(`joins the answered questions with the SSOT's answer_joiner ("${CFG.answer_joiner}")`, real.words.includes(CFG.answer_joiner), real.text);
  check(`prefixes the location with the SSOT's location_prefix ("${CFG.location_prefix} bedroom")`, real.text.includes(CFG.location_prefix + ' bedroom'), real.text);
  check(`labels the surcharge strip with the SSOT's logistic_strip_label ("${CFG.logistic_strip_label}")`, real.strip.startsWith(CFG.logistic_strip_label), real.strip);

  console.log('\n=== 2. counterfactual world: change all five phrases in the data; the sentence follows, and no old word survives ===');
  const mutateDb = DB => { Object.assign(DB.adlib_phrase_overrides.adlib, NEW); };
  const cf = await render({ mutateDb });
  check('opens with the NEW sentence_start', cf.words[0] === NEW.sentence_start, cf.text);
  check('uses the NEW scope_separator', cf.words.includes(NEW.scope_separator), cf.text);
  check('uses the NEW answer_joiner', cf.words.includes(NEW.answer_joiner), cf.text);
  check('uses the NEW location_prefix', cf.text.includes(NEW.location_prefix + ' bedroom'), cf.text);
  check('uses the NEW logistic_strip_label', cf.strip.startsWith(NEW.logistic_strip_label), cf.strip);
  const leftover = OLD_WORDS.filter(o => (cf.words.includes(o)) || cf.text.includes(o + ' bedroom') || cf.strip.startsWith(o));
  check('none of the five old phrases survives anywhere in the sentence or the strip (nothing is hardcoded any more)', leftover.length === 0, 'still speaking: ' + leftover.join(', '));
  check('the sentence reads nothing from the non-existent ui_config.adlib path', !/ui_config\?*\.adlib\b/.test(HTML.replace(/\/\/[^\n]*/g, '')));

  console.log('\n=== 3. mutant: re-introduce the defect (the ad-lib ignores the config) and the same check catches it ===');
  const mutHtml = html => { const a = "const _adlibCfg = DB.adlib_phrase_overrides?.adlib || {};"; if (!html.includes(a)) throw new Error('mutant anchor missing (the ad-lib config read)'); return html.replace(a, 'const _adlibCfg = {};'); };
  let mutant = null, anchorOk = true;
  try { mutant = await render({ mutateDb, mutateHtml: mutHtml }); } catch (e) { anchorOk = false; console.log('      ' + e.message); }
  check('MUTANT (config read as {}) can be built (the anchor exists in the source)', anchorOk);
  if (mutant) {
    const stillOld = OLD_WORDS.filter(o => (mutant.words.includes(o)) || mutant.text.includes(o + ' bedroom') || mutant.strip.startsWith(o));
    check('MUTANT is caught: with the config ignored, the old phrases come back in a world whose data says otherwise', stillOld.length >= 4, 'old phrases back: ' + stillOld.join(', '));
  }

  console.log(`\n[ad-lib phrases live in the SSOT, C-09] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
  process.exit(fail ? 1 : 0);
})();
