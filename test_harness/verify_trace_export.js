#!/usr/bin/env node
/**
 * verify_trace_export.js
 *
 * (No @enforces tag: the Charter declares no Rule for trace; the contract this file holds is the Layer Map's Observation layer and PENDING_DECISIONS #77, as in verify_trace_observation_only.js.)
 *
 * WHAT THIS PROVES (T184, PENDING_DECISIONS #243). modules/trace.js is loaded by qr.html as a plain <script>. A script with one syntax error does not load at all, and a call to a
 * function nobody defined throws the first time it runs, so neither was visible to the tests that only record entries. This test loads the tracer into a real DOM (jsdom, the way the page
 * loads it), fills the log with one entry of every kind the tracer emits, opens the overlay, and uses every export surface the operator uses:
 *
 *   1. the file is valid JavaScript and defines every function the page and its own buttons call (the Markdown issue report included);
 *   2. with the overlay open, `_trace` returns the entry id it recorded (not null) and the overlay paints a toolbar and one card per entry;
 *   3. `_traceExport` (Copy JSON) returns one valid JSON document, single-line when compact, carrying meta, summary, annotations, the narrative, the Markdown report and the whole log;
 *   4. the Markdown report is well-formed GitHub Markdown: balanced code fences and <details>, the sections its input calls for, the table, the click target, the roadmap lines;
 *   5. the narrative describes each kind of entry in words (a failure to decode one is a '?', never an exception);
 *   6. both text views are presentations only (#77): neither mutates the log or the state it is handed; an empty log is answered, not thrown at;
 *   7. a failure inside a text view costs the operator that view only: the JSON export still comes back, and the Markdown button still copies something;
 *   8. the Copy JSON and Copy Markdown Issue buttons put the right text on the clipboard.
 *
 * Each claim is shown able to fail (R-INVARIANT-PREFIX): the probe is re-run against two mutants of the real file, "the Markdown builder is not defined" (the state of the file before T184:
 * Copy JSON and the Markdown button threw) and "the repaint call is misspelled" (the state of the file at 47056f83: `_trace` returned null with the overlay open), and must see each fail.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { JSDOM } = require(path.join(__dirname, 'node_modules', 'jsdom'));

const REPO_ROOT = path.dirname(__dirname);
const TRACE_SRC = fs.readFileSync(path.join(REPO_ROOT, 'modules', 'trace.js'), 'utf8');

let pass = 0, fail = 0;
function check(label, cond, detail) {
  if (cond) { pass++; console.log('  ✓ ' + label); }
  else { fail++; console.log('  ✗ ' + label + (detail !== undefined ? '\n      ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) : '')); }
}
const tick = (w, ms = 60) => new Promise(r => w.setTimeout(r, ms));

// A window with the tracer loaded, a page-shaped DOM around it, and the clipboard replaced by a recorder.
function world(src, { open = true } = {}) {
  const dom = new JSDOM(
    '<!doctype html><html><body>' +
    '<div id="traceOverlayPanel" style="display:none"></div>' +
    '<div class="main-card-schedule-service focused-mode"></div>' +
    '<div id="sqTextBar">type here</div>' +
    '<div id="sqStepFlow" style="display:none">steps</div>' +
    '<button id="orderBtn" class="sq-ic-btn big">Order</button>' +
    '</body></html>',
    { runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://example.test/' });
  const w = dom.window;
  const clip = [];
  Object.defineProperty(w.navigator, 'clipboard', { value: { writeText: s => { clip.push(String(s)); return Promise.resolve(); } }, configurable: true });
  w.DB = { meta: { version: 'test' } };
  w.State = { currentStep: 3 };
  const warns = [];
  w.console.warn = (...a) => { warns.push(a.map(String).join(' ')); };   // recorded, not printed: the mutants below fail on purpose
  w.eval(src);
  w._traceEnabled = false;
  if (open) w._traceToggle(true);
  return { w, clip, warns, dom };
}

// The probe: everything the claims above need, collected without throwing, so a mutant fails individual checks instead of crashing the file.
async function probe(src) {
  const out = { errors: [] };
  const guard = (name, f) => { try { return f(); } catch (e) { out.errors.push(name + ': ' + (e && e.message || e)); return undefined; } };

  // 1. the file defines what the page and its own buttons call
  out.parses = guard('parse', () => { new vm.Script(src, { filename: 'trace.js' }); return true; }) === true;
  if (!out.parses) return out;
  const W = guard('load', () => world(src));
  if (!W) return out;
  const { w, clip, warns } = W;
  out.defined = {};
  for (const f of ['_trace', '_traceFn', '_traceStart', '_traceExport', '_traceNarrative', '_traceToggle', '_buildAutomatedIssueSummary', '_renderTraceOverlay', '_traceDomSnapshot', '__traceLast']) {
    out.defined[f] = typeof w[f] === 'function';
  }

  // 2. with the overlay open `_trace` returns the id it recorded
  out.openReturnsId = guard('trace open', () => { const id = w._trace('session', 'probe_open', { n: 1 }); return id != null && w._traceLog[w._traceLog.length - 1].id === id; }) === true;
  out.warnsAfterOpen = warns.filter(s => s.includes('[trace]')).length;

  // fill the log with one entry of every kind
  guard('start', () => w._traceStart('fix a leaking kitchen faucet', 'smart_quote'));
  guard('mismatch', () => w._trace('session', 'entry_path_mismatch', { expected: 'smart_quote', foundBreadcrumbs: [{ type: 'category' }, 'group'], step: 3 }));
  guard('nlp', () => w._trace('nlp_engine', 'match', { winningKeyword: 'faucet', category: 'plumbing', matchConfidence: 0.91 }));
  guard('orch', () => w._trace('orchestrator_engine', 'route', { resolvedGroupId: 'plumbing_fixtures' }));
  guard('price', () => w._trace('pricing_engine', 'quote', { laborEstimate: 185, qty: 1, complexityTier: 'standard', dispatchFee: 25, friction: 2, frictionThreshold: 3, totalConfidence: 1, answers: { q1: 'a' } }));
  guard('cart', () => w._trace('ui_renderer', 'sqAddToCart: invoked', { qty: 1, answersCount: 2 }));
  guard('tiles', () => w._traceTiles([w.document.getElementById('orderBtn')], 'tiles_read'));
  guard('fn', () => { const f = w._traceFn('someFunction', { a: 1 }); f.branch('left', { x: 1 }); f.return({ ok: true }); });
  guard('err', () => w._trace('session', 'window_error', { message: 'boom `x`', file: 'qr.html', line: 12, col: 3 }));
  guard('rej', () => w._trace('session', 'unhandled_rejection', { reason: 'nope' }));
  guard('state', () => w._trace('session', 'state_change', { changes: { step: { before: 2, after: 3 }, visibility: { sqTextBar: { before: 'none', after: 'block/vis/10x10' } } } }));
  guard('click', () => w.document.getElementById('orderBtn').dispatchEvent(new w.MouseEvent('click', { bubbles: true, clientX: 5, clientY: 6 })));
  guard('change', () => w._trace('user_interaction', 'change', { tag: 'input', value: 'x'.repeat(80) }));
  guard('settled', () => w._trace('user_interaction', 'input_settled', { value: 'hello', tag: 'input' }));
  guard('dom', () => w._traceDomSnapshot('probe snapshot'));
  await tick(w, 80);
  const flaggedTarget = w._traceLog[w._traceLog.length - 1];
  guard('flag', () => { flaggedTarget._flag = { flagged: true, note: 'looks wrong', flaggedAt: 1 }; });
  out.logLength = w._traceLog.length;

  // overlay painted
  await tick(w, 80);
  const panel = w.document.getElementById('traceOverlayPanel');
  out.panel = guard('panel', () => ({ display: panel.style.display, toolbar: !!panel.querySelector('#traceToolbar'), cards: panel.querySelectorAll('#traceListContainer > div').length, buttons: [...panel.querySelectorAll('button')].map(b => b.textContent) }));

  // 3. the JSON export
  const snapshotBefore = guard('snap', () => JSON.stringify(w._traceLog));
  const compact = guard('export compact', () => w._traceExport(true));
  const pretty = guard('export pretty', () => w._traceExport(false));
  out.compactIsString = typeof compact === 'string';
  out.compactSingleLine = typeof compact === 'string' && !compact.includes('\n');
  out.prettyMultiLine = typeof pretty === 'string' && pretty.includes('\n');
  out.payload = guard('parse export', () => JSON.parse(compact));
  out.sameLogAfterExport = guard('snap2', () => JSON.stringify(w._traceLog)) === snapshotBefore;

  // 4/5/6. the text views
  const state = guard('state read', () => w._readObservableState(true));
  const stateJson = JSON.stringify(state || null);
  out.md = guard('md', () => w._buildAutomatedIssueSummary(w._traceLog, state));
  out.narrative = guard('narrative', () => w._traceNarrative(w._traceLog));
  out.viewsPure = JSON.stringify(w._traceLog) === snapshotBefore && JSON.stringify(state || null) === stateJson;
  out.emptyMd = guard('md empty', () => w._buildAutomatedIssueSummary([], {}));
  out.emptyNarrative = guard('narrative empty', () => w._traceNarrative([]));
  out.sparseMd = guard('md sparse', () => w._buildAutomatedIssueSummary([{ id: 1, t: 1, layer: 'user_interaction', label: 'click' }, { id: 2, t: 2, layer: 'session', label: 'window_error' }, { id: 3, t: 3, layer: 'session', label: 'entry_path_mismatch' }], null));
  out.sparseNarrative = guard('narrative sparse', () => w._traceNarrative([{ id: 1, t: 1, layer: 'user_interaction', label: 'click' }, { id: 2, t: 2, layer: 'fn_call', label: 'f' }, { id: 3, t: 3, layer: 'dom_snapshot', label: 'x' }, { id: 4, t: 4, layer: 'pricing_engine', label: 'y' }]));

  // 8. the buttons
  const buttons = guard('buttons', () => [...panel.querySelectorAll('button')]) || [];
  // found once, by their labels: a button relabels itself ("Copied Markdown!") for a moment after a click
  const jsonBtn = buttons.find(b => b.textContent === 'Copy JSON');
  const mdBtn = buttons.find(b => b.textContent === 'Copy Markdown Issue');
  clip.length = 0;
  guard('click json', () => jsonBtn.click());
  out.copiedJson = clip[0];
  guard('click md', () => mdBtn.click());
  out.copiedMd = clip[1];

  // 7. a failing view costs that view only
  w._buildAutomatedIssueSummary = () => { throw new Error('mutant report'); };
  const exportWithBrokenReport = guard('export broken report', () => JSON.parse(w._traceExport(true)));
  out.brokenReport = exportWithBrokenReport && { hasTrace: Array.isArray(exportWithBrokenReport.trace) && exportWithBrokenReport.trace.length === out.logLength, md: exportWithBrokenReport.issueReportMarkdown, narrative: typeof exportWithBrokenReport.narrative };
  clip.length = 0;
  guard('click md broken', () => mdBtn.click());
  out.copiedMdBroken = clip[0];
  w._traceNarrative = () => { throw new Error('mutant narrative'); };
  const exportWithBrokenNarrative = guard('export broken narrative', () => JSON.parse(w._traceExport(true)));
  out.brokenNarrative = exportWithBrokenNarrative && { hasTrace: Array.isArray(exportWithBrokenNarrative.trace), narrative: exportWithBrokenNarrative.narrative };

  out.warnsTotal = warns.filter(s => s.includes('[trace]')).length;
  w.close();
  return out;
}

(async () => {
  console.log('=== 1. the real file loads in a real DOM and defines everything the page and its buttons call ===');
  const real = await probe(TRACE_SRC);
  check('modules/trace.js is valid JavaScript', real.parses === true, real.errors);
  check('... and loads without throwing', real.errors.every(e => !e.startsWith('load')), real.errors);
  const missing = Object.keys(real.defined || {}).filter(k => !real.defined[k]);
  check('every function the page or the tracer\'s own buttons call is defined (incl. _buildAutomatedIssueSummary)', real.defined && missing.length === 0, 'missing: ' + missing.join(', '));
  check('no step of the probe threw', real.errors.length === 0, real.errors);

  console.log('\n=== 2. with the overlay open the tracer returns the id it recorded, swallows nothing, and paints ===');
  check('_trace returns the id of the entry it just recorded', real.openReturnsId === true);
  check('no "[trace] entry failed" warning was raised while recording or exporting', real.warnsTotal === 0, real.warnsTotal);
  check('the overlay panel is shown and holds a toolbar', real.panel && real.panel.display === 'flex' && real.panel.toolbar === true, real.panel);
  check('the overlay shows one card per entry in the log', real.panel && real.panel.cards === real.logLength, real.panel && ('cards ' + real.panel.cards + ' vs log ' + real.logLength));
  check('the toolbar has both copy buttons', real.panel && real.panel.buttons && ['Copy JSON', 'Copy Markdown Issue', 'Clear'].every(t => real.panel.buttons.includes(t)), real.panel && real.panel.buttons);

  console.log('\n=== 3. Copy JSON: one valid JSON document carrying everything ===');
  const P = real.payload || {};
  check('the export is valid JSON', !!real.payload);
  check('compact (the default) is a single line; compact=false is indented', real.compactSingleLine === true && real.prettyMultiLine === true);
  check('meta names the tracer build, the entry path and the entry count', P.meta && /^T\d+$/.test(P.meta.traceBuildVersion) && /smart_quote|catalog/.test(P.meta.entryPath) && P.meta.totalEntries === real.logLength, P.meta);
  check('the whole log is in the export, entry for entry', Array.isArray(P.trace) && P.trace.length === real.logLength);
  check('the pricing summary is the last pricing entry (finalPrice 185, dispatchFee 25)', P.summary && P.summary.finalPrice === 185 && P.summary.dispatchFee === 25, P.summary);
  check('the flagged entry is exported as an annotation with its note', Array.isArray(P.annotations) && P.annotations.length === 1 && P.annotations[0].note === 'looks wrong', P.annotations);
  check('state changes are summarised', P.stateChanges && P.stateChanges.length === 1 && P.stateChanges[0].changed.includes('step'), P.stateChanges);
  check('the export carries the narrative and the Markdown issue report as text', typeof P.narrative === 'string' && P.narrative.startsWith('=== TRACE NARRATIVE') && typeof P.issueReportMarkdown === 'string' && P.issueReportMarkdown.startsWith('### 🐛 Automated Issue Report Summary'));
  check('exporting does not change the log (#77)', real.sameLogAfterExport === true);

  console.log('\n=== 4. the Markdown issue report is well-formed GitHub Markdown ===');
  const md = typeof real.md === 'string' ? real.md : '';
  const mdLines = md.split('\n');
  check('the report is a non-empty string', md.length > 200);
  const fences = mdLines.filter(l => l.startsWith('```'));
  check('code fences are balanced (an unclosed fence swallows the rest of an issue)', fences.length > 0 && fences.length % 2 === 0, fences.length);
  check('<details> and </details> are balanced and the summary is present', mdLines.filter(l => l === '<details>').length === 1 && mdLines.filter(l => l === '</details>').length === 1 && md.includes('<summary>Click Target Interaction Details</summary>'));
  const fenced = (md.match(/```json\n([\s\S]*?)\n```/) || [])[1];
  let fencedJson = null; try { fencedJson = JSON.parse(fenced); } catch (e) { /* reported below */ }
  check('the fenced block is valid JSON describing the last click target (button#orderBtn)', fencedJson && fencedJson.tag === 'button' && fencedJson.id === 'orderBtn' && fencedJson.clickCoords && fencedJson.clickCoords.x === 5, fenced);
  check('the click target is named as an inline selector', md.includes('target: `button#orderBtn.sq-ic-btn.big`.'), mdLines.find(l => l.includes('originated from')));
  for (const h of ['### 🐛 Automated Issue Report Summary', '### 📂 Context & Metadata', '### 🚨 Intercepted Exceptions & Mismatches', '### 📊 Observed State Discrepancy Matrix', '### 🔍 Intercepted Component Layout', '### 📋 Actionable Resolution Roadmap']) {
    check('has the section "' + h + '"', mdLines.includes(h));
  }
  check('context lists the entry path, the flag count and the log size', md.includes('* Entry Path: `smart_quote`') && md.includes('* Flagged Annotations: 1') && md.includes('* Total Log Size: ' + real.logLength + ' entries'));
  check('the window error and the rejection are listed (an error text with a backtick does not break the line)', md.includes('* [window_error] `boom `x``') && md.includes('* [unhandled_rejection] `nope`'));
  check('the entry-path mismatch names what the caller claimed and the breadcrumbs found', md.includes('* [Entry Path Mismatch] Caller claimed `smart_quote` but found breadcrumbs: [category > group]'));
  const tableRows = mdLines.filter(l => l.startsWith('| '));
  check('the state table has a header, a divider and one row per observed property, every row three cells wide', tableRows.length >= 4 && tableRows[0].startsWith('| State Property') && tableRows.every(r => r.split(' | ').length === 3 || /^\| :---/.test(r)), tableRows.slice(0, 4));
  check('a hidden element is reported as hidden and a visible one as visible', md.includes('| visibility.sqStepFlow | "none" | Element is hidden or collapsed') && /\| visibility\.sqTextBar \| "[^"]*\/hid\/[^"]*" \| Element is hidden/.test(md) && md.includes('| visibility.cartOverlay | "absent" | Element is hidden or collapsed'), tableRows.filter(r => /sqStepFlow|sqTextBar/.test(r)));
  check('the roadmap flags the layout conflict (focused mode with the text bar showing), the trapped step flow, and the flagged entries', md.includes('* [Layout Conflict]') && md.includes('* [Flow Trapped] Component wizard container sqStepFlow is hidden (none) despite active state pointing to step 3.') && md.includes('* [Developer Intent] Review the 1 manually flagged logs'), mdLines.slice(-6));
  check('an empty log is answered, not thrown at', real.emptyMd === 'No data available to construct summary.');
  check('a sparse log (entries with no data, no state) still produces a report', typeof real.sparseMd === 'string' && real.sparseMd.includes('### 🐛 Automated Issue Report Summary'), real.errors);

  console.log('\n=== 5. the narrative describes each kind of entry in words ===');
  const nar = typeof real.narrative === 'string' ? real.narrative : '';
  for (const [what, needle] of [
    ['the start', '── new smart_quote entry: fix a leaking kitchen faucet'],
    ['an entry-path mismatch', '⚠ entryPath mismatch: caller claimed "smart_quote"'],
    ['an NLP match', 'NLP matched: "faucet" (confidence 0.91) → category plumbing'],
    ['a route', 'Routed to group: plumbing_fixtures'],
    ['a price', 'Price computed: $185 (qty 1, tier standard, friction 2 (need 3, have 1)) + $25 dispatch'],
    ['an add-to-cart', 'Add to Cart invoked (qty 1, 2 answers on file)'],
    ['a function call, a branch and a return', 'fn someFunction('],
    ['a window error', 'window.onerror: boom `x` (qr.html:12)'],
    ['an unhandled rejection', 'unhandled rejection: nope'],
    ['a state change', '↻ state changed'],
    ['a click', 'User tapped: Order'],
    ['a change (long values cut at 60)', 'User changed input: "' + 'x'.repeat(60) + '…"'],
    ['a settled input', 'User typed (settled): "hello" into input'],
    ['the flagged entries', '🚩 1 flagged entry:'],
  ]) check('describes ' + what, nar.includes(needle), needle);
  check('an empty log is answered', real.emptyNarrative === 'No trace log entries recorded.');
  check('entries with no data (a "?" in each gap) do not throw', typeof real.sparseNarrative === 'string' && real.sparseNarrative.includes('=== TRACE NARRATIVE (Entries: 4) ==='), real.errors);

  console.log('\n=== 6. the views are presentations only (#77) ===');
  check('building the narrative and the report changed neither the log nor the state they were given', real.viewsPure === true);

  console.log('\n=== 7. a failing view costs the operator that view only ===');
  const bR = real.brokenReport || {};
  check('with the report builder throwing, Copy JSON still returns the whole log and the narrative', bR.hasTrace === true && bR.narrative === 'string');
  check('... and the report slot says the report is unavailable instead of losing the export', typeof bR.md === 'string' && bR.md.startsWith('[issue report unavailable: mutant report'), bR.md);
  check('... and the Markdown button still copies a note instead of throwing', typeof real.copiedMdBroken === 'string' && real.copiedMdBroken.startsWith('[issue report unavailable: mutant report'), real.copiedMdBroken);
  const bN = real.brokenNarrative || {};
  check('with the narrative builder throwing, Copy JSON still returns the whole log', bN.hasTrace === true && typeof bN.narrative === 'string' && bN.narrative.startsWith('[narrative unavailable: mutant narrative'), bN.narrative);

  console.log('\n=== 8. the buttons put the right text on the clipboard ===');
  let copied = null; try { copied = JSON.parse(real.copiedJson); } catch (e) { /* reported below */ }
  check('Copy JSON copies the single-line export', !!copied && !real.copiedJson.includes('\n') && Array.isArray(copied.trace) && copied.trace.length >= real.logLength);
  check('Copy Markdown Issue copies the report', typeof real.copiedMd === 'string' && real.copiedMd.startsWith('### 🐛 Automated Issue Report Summary') && real.copiedMd.includes('### 📋 Actionable Resolution Roadmap'));

  console.log('\n=== 9. every claim above is shown able to fail: two mutants of the real file ===');
  {
    // the file before T184: the builder both buttons call was never defined
    const noBuilder = TRACE_SRC.replace('function _buildAutomatedIssueSummary(', 'function _buildAutomatedIssueSummary_REMOVED(');
    check('(mutant setup) the replacement changed the file', noBuilder !== TRACE_SRC);
    const m1 = await probe(noBuilder);
    check('MUTANT "the Markdown builder is not defined": the definition check fails', m1.defined && m1.defined._buildAutomatedIssueSummary === false);
    check('... Copy JSON no longer returns a valid document of the right shape (the export throws or loses the report)', !(m1.payload && typeof m1.payload.issueReportMarkdown === 'string' && m1.payload.issueReportMarkdown.startsWith('### 🐛')), m1.errors.slice(0, 2));
    check('... and the Markdown button no longer copies the report', !(typeof m1.copiedMd === 'string' && m1.copiedMd.startsWith('### 🐛')));

    // the file at 47056f83: the repaint call inside `_trace` named a function that does not exist
    const badRepaint = TRACE_SRC.replace('if (overlayOn) _scheduleRender();', 'if (overlayOn) scheduleRender();');
    check('(mutant setup) the replacement changed the file', badRepaint !== TRACE_SRC);
    const m2 = await probe(badRepaint);
    check('MUTANT "the repaint call is misspelled": `_trace` with the overlay open no longer returns the id it recorded', m2.openReturnsId === false);
    check('... and the swallowed failure is visible as a "[trace] entry failed" warning', m2.warnsTotal > 0, m2.warnsTotal);

    // a file that does not parse
    const stray = TRACE_SRC.replace("out.sqSc3Class =", "Use code with caution.\n            out.sqSc3Class =");
    check('(mutant setup) the replacement changed the file', stray !== TRACE_SRC);
    const m3 = await probe(stray);
    check('MUTANT "a stray line of prose in the file": the parse check fails', m3.parses === false);
  }

  console.log('\n[trace export, narrative and Markdown issue report, T184] ' + pass + ' passed, ' + fail + ' failed (of ' + (pass + fail) + ' checks)');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
