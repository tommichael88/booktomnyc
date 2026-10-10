#!/usr/bin/env node
/**
 * verify_architectural_conformance.js -- the one test that answers "is the tree still the architecture the 2026-10-10 mandate landed?", and the check
 * R-GOVERN-TRANSITION asks for on the ledger of that mandate.
 *
 * @enforces R-INVARIANT-DISEASE
 * @enforces R-GOVERN-TRANSITION
 *
 * WHAT IT HOLDS. Items B to G each landed one rule and one class detector. This file holds the SET. Its roster (ROSTER, below) names, for each landed item, the
 * Charter rules it serves, the defect class (when the Charter has one), the kind of claim it is (P-GOVERN-GOODHART: behavioral, source-shape or mixed), the detector
 * that holds it and a floor on that detector's checks. For every row it asserts:
 *
 *   1. The detector EXISTS, and is LISTED in MASTER_TEST_SUITE.json (a detector the suite does not run cannot fail).
 *   2. Its header TAGS are real: it `@enforces` every rule the roster names, each a Rule the Charter declares (an orphan tag is what a renamed rule looks like), and
 *      `@detects` the defect class the roster names, a class the Charter declares.
 *   3. Its MECHANISM fits its claim (P-GOVERN-GOODHART: "test behavior where the rule is behavioral"): a behavioral or mixed claim is held by a detector that
 *      evaluates the page's real code (it boots the page or runs its code in a context). It does not prove the detector is good; it catches one rewritten into
 *      a text match over source for a rule about behavior.
 *   4. It RUNS GREEN, and has not been hollowed out: it exits 0, its own summary says no check failed, and it reports at least the floor of checks. A floor is
 *      raised when a detector gains checks and lowered only here, in a reasoned edit (a detector that quietly loses half its checks stays green on its own).
 *   5. Its LEDGER ENTRY (R-GOVERN-TRANSITION): TIMELINE.md has the item's entry, and the entry states the workaround the old shape forced (Rationale), the shape it
 *      ended at (Endpoint), the defect class, the detector and the rules, each concrete (it names things in backticks), the detector the one the roster holds, every
 *      code it cites a declared one. The Charter: "The enforcement check asserts that every ledger entry describing a structural change carries both a rationale
 *      and an endpoint." Nothing asserted it until this file.
 *   6. COMPLETENESS, both ways: every `## T### -- Item X of the 2026-10-10 mandate` heading in TIMELINE.md is a roster row (a landed item with no detector row is red),
 *      and every roster row has its heading. This file's own entry (H) is held to the same.
 *
 * WHY IT COMPOSES THE DETECTORS AND DOES NOT COPY THEM. The plan (SESSION_PLAN, H) said this file "holds one class detector per rule landed". It holds six, by name,
 * and runs them: each is 200-350 lines that drive the real gateways, boot the page or enumerate the whole catalog. Writing a second, smaller copy of each here would
 * be the defect the mandate removes (R-INVARIANT-SINGLEDEF: one definition), and a smaller copy that drifts from the detector it shadows is worse than none. What this
 * file adds is what no single detector can hold about itself: that it still exists, is still run, still claims the rule it was written for, still has its checks,
 * and that the change it guards has its rationale and endpoint on the record.
 *
 * G-INVARIANT-PREFIX. Every detector fails on `3f27e83` (the tree before the mandate); so does this file, for each row. To reproduce, from a checkout of the
 * repository:  git archive 3f27e83 | tar -x -C <dir>;  copy this file and the six detectors into <dir>/test_harness;  link test_harness/node_modules;
 * node test_harness/extract_modules.js (in <dir>);  node test_harness/verify_architectural_conformance.js (in <dir>).  The detectors read the tree they sit in.
 * `node verify_architectural_conformance.js --list` prints the roster and runs nothing.
 *
 * NON-VACUITY. The pure checks (header, mechanism, summary, ledger, registration) are run on synthetic inputs, each of which must give exactly the verdict stated:
 * a header that lacks a rule, that names an undeclared one, that lacks the class; a behavioral claim held by a text-only detector; a summary of zero checks, of a
 * failure, of nothing; an exit code that disagrees with a clean summary; a ledger entry with no block, with no endpoint, with a placeholder rationale, with an
 * abstract one, with another detector's name, with a class the Charter does not declare, with a rule it does not declare; an unlisted detector.
 *
 * WHAT IT DOES NOT COVER (named, so it is not mistaken for more): that a detector is the right one for its rule (the roster records what the author claims and the
 * Charter's categories keep it honest; a better detector is a reasoned edit to the row); that a ledger rationale is TRUE (it checks that one is stated, concrete and
 * consistent with the roster); the ledger of items outside this mandate.
 *
 * Exit: 0 = every row conforms and every probe behaves; 1 = otherwise.
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const charterModel = require('./charter_model.js');

const HARNESS = __dirname;
const REPO_ROOT = path.resolve(HARNESS, '..');
const SELF = path.basename(__filename);

// ───────────────────────────────────────── the roster ─────────────────────────────────────────
// item/ticket: the TIMELINE entry. rules: Rules the detector's header must @enforce. defect: the Charter class its header must @detects (null where the Charter
// declares none for it: the ledger block says so). kind: P-GOVERN-GOODHART's category of the claim. floor: the fewest checks the detector may report.
const ROSTER = [
    { item: 'B', ticket: 'T159', claim: 'one confidence resolver', kind: 'behavioral', file: 'verify_confidence_convergence.js', floor: 24,
      rules: ['R-CONF-ONEFORMULA', 'R-CLIENT-CONVERGE', 'R-INVARIANT-CANONICAL'], defect: null },
    { item: 'C', ticket: 'T160', claim: 'no business number held in code', kind: 'mixed', file: 'verify_fallbacks_live_in_ssot.js', floor: 41,
      rules: ['R-SYSTEM-NODATA', 'R-INVARIANT-SINGLEDEF'], defect: null },
    { item: 'D', ticket: 'T161', claim: 'one escalation path; the retired copy absent', kind: 'mixed', file: 'verify_single_escalation_path.js', floor: 24,
      rules: ['R-CONF-ONEFORMULA', 'R-INVARIANT-CANONICAL', 'R-INVARIANT-DELETION', 'R-INVARIANT-DUPLICATION-TICKET'], defect: null },
    { item: 'E', ticket: 'T162', claim: 'no duplicate registry', kind: 'source-shape', file: 'verify_no_duplicate_registries.js', floor: 25,
      rules: ['R-INVARIANT-SINGLEDEF', 'R-INVARIANT-DUPLICATION-TICKET'], defect: 'DEFECT-DUPLICATE-REGISTRY' },
    { item: 'F', ticket: 'T163', claim: 'no duplicate module source; truthful headers', kind: 'source-shape', file: 'verify_module_deployment_shape.js', floor: 29,
      rules: ['R-INVARIANT-SINGLEDEF', 'R-SYSTEM-SCRIPT'], defect: null },
    { item: 'G', ticket: 'T164', claim: 'no non-retiring answer (the delta check)', kind: 'behavioral', file: 'verify_non_retiring_answers.js', floor: 26,
      rules: ['R-INTAKE-NONRETIRING', 'R-INTAKE-WIREREMOVE'], defect: 'DEFECT-NON-RETIRING-ANSWER' },
];
// This file's own entry. It is held to the ledger leg like the rest; it is not a row (it is not one of the detectors it runs).
const SELF_ROW = { item: 'H', ticket: 'T165', claim: 'the set of detectors, and the ledger', file: SELF, rules: ['R-INVARIANT-DISEASE', 'R-GOVERN-TRANSITION'], defect: null };

const KINDS = ['behavioral', 'source-shape', 'mixed'];
const LABELS = ['Rationale', 'Endpoint', 'Defect class', 'Detector', 'Rules'];
const CODE_RE_G = /\b[RGP]-[A-Z0-9]+(?:-[A-Z0-9]+)+\b/g;
const PLACEHOLDER = /^(tbd|todo|n\/a|na|none|unknown|it feels wrong|\?+|-+|\.+)\b/i;
const RUN_TIMEOUT_MS = 150000;

// ───────────────────────────────────────── pure checks (each returns a list of problems; [] = conforms) ─────────────────────────────────────────
// The Charter's declarations, as sets: { all, rules, classes }.
function declaredOf(model) {
    const all = new Set([...model.definitions.map(d => d.code), ...model.index.keys()]);
    return { all, rules: new Set([...all].filter(c => charterModel.categoryOf(c) === 'rule')), classes: new Set(model.defectClasses) };
}

// The detector's header tags, as charter_model reads them (enf = charterModel.readEnforcements(dir)).
function checkHeader(file, row, enf, declared) {
    const probs = [];
    for (const code of row.rules) {
        if (!(enf.tagged.get(code) || []).includes(file)) probs.push(`its header does not @enforces ${code}`);
        if (!declared.rules.has(code)) probs.push(`${code}, which the roster says it enforces, is not a Rule the Charter declares`);
    }
    for (const [code, files] of enf.tagged) {
        if (files.includes(file) && !declared.rules.has(code)) probs.push(`its header @enforces ${code}, which is not a Rule the Charter declares (an orphan: renamed or retired?)`);
    }
    if (row.defect) {
        if (!(enf.detects.get(row.defect) || []).includes(file)) probs.push(`its header does not @detects ${row.defect}`);
        if (!declared.classes.has(row.defect)) probs.push(`${row.defect}, which the roster says it detects, is not a defect class the Charter declares`);
    }
    for (const [code, files] of enf.detects) {
        if (files.includes(file) && !declared.classes.has(code)) probs.push(`its header @detects ${code}, which is not a defect class the Charter declares`);
    }
    return probs;
}

// P-GOVERN-GOODHART: the mechanism follows the claim. A claim that is (partly) about behavior is held by a detector that evaluates the page's real code.
function checkMechanism(kind, src) {
    if (!KINDS.includes(kind)) return [`the roster's kind "${kind}" is not one of ${KINDS.join(', ')}`];
    if (kind === 'source-shape') return [];
    return /\bJSDOM\b|\brunInContext\b|\bnew\s+vm\.Script\b|\bvm\.run/.test(src) ? [] : [`a ${kind} claim is held by a detector that never evaluates the page's code (no JSDOM, no vm context): it would be a text match over source standing in for behavior`];
}

// A detector's run: { code, timedOut, out }.
function checkRun(row, run) {
    const probs = [];
    if (run.timedOut) return [`did not finish in ${RUN_TIMEOUT_MS / 1000} s`];
    const m = [...run.out.matchAll(/(\d+) passed, (\d+) failed \(of (\d+) checks\)/g)].pop();
    if (!m) { probs.push('printed no "N passed, M failed (of T checks)" summary'); }
    else {
        const [pass, fail, total] = [+m[1], +m[2], +m[3]];
        if (fail !== 0) probs.push(`${fail} of its ${total} checks fail`);
        if (pass + fail !== total) probs.push(`its summary does not add up (${pass} + ${fail} != ${total})`);
        if (total < row.floor) probs.push(`it reports ${total} checks; the floor is ${row.floor} (a detector that loses checks stays green on its own; lower the floor here, with a reason, if that was intended)`);
    }
    if (run.code !== 0) probs.push(`it exited ${run.code}`);
    return probs;
}

function checkRegistered(file, master) { return (master.test_files || []).includes(file) ? [] : [`${file} is not listed in MASTER_TEST_SUITE.json (the suite does not run it)`]; }

// R-GOVERN-TRANSITION: the entry's ledger block.
function ledgerOf(section) {
    const out = {};
    for (const l of LABELS) { const m = new RegExp('^- \\*\\*' + l + '\\.\\*\\* (.+)$', 'm').exec(section); out[l] = m ? m[1].trim() : null; }
    return out;
}
function checkLedger(section, row, declared) {
    const probs = [];
    if (section == null) return [`TIMELINE.md has no entry headed "## ${row.ticket} -- Item ${row.item} of the 2026-10-10 mandate"`];
    if (!/R-GOVERN-TRANSITION/.test(section)) probs.push('the entry has no Ledger block (R-GOVERN-TRANSITION)');
    const L = ledgerOf(section);
    for (const l of LABELS) if (!L[l]) probs.push(`the Ledger block has no "${l}." line`);
    const concrete = t => /`[^`]+`/.test(t);
    if (L.Rationale) {
        if (PLACEHOLDER.test(L.Rationale) || L.Rationale.length < 80) probs.push('the Rationale is a placeholder or too short to name a workaround (80 characters at least)');
        else if (!concrete(L.Rationale)) probs.push('the Rationale names no thing in backticks: "it feels wrong" is not a rationale, a named workaround is');
    }
    if (L.Endpoint) {
        if (PLACEHOLDER.test(L.Endpoint) || L.Endpoint.length < 60) probs.push('the Endpoint is a placeholder or too short to state a shape (60 characters at least)');
        else if (!concrete(L.Endpoint)) probs.push('the Endpoint names no thing in backticks: it does not say the new shape plainly');
    }
    if (L.Detector) {
        const named = [...L.Detector.matchAll(/`([^`]+)`/g)].map(x => x[1].replace(/\.$/, ''));
        if (!named.includes(row.file)) probs.push(`the Detector line names ${named.join(', ') || 'nothing'}; the roster holds ${row.file}`);
    }
    if (L['Defect class']) {
        const text = L['Defect class'], codes = text.match(/DEFECT-[A-Z0-9]+(?:-[A-Z0-9]+)*/g) || [];
        for (const c of codes) if (!declared.classes.has(c)) probs.push(`the Defect class line names ${c}, which the Charter does not declare`);
        if (row.defect) { if (codes[0] !== row.defect) probs.push(`the Defect class line should lead with ${row.defect}, the class the roster holds`); }
        else if (!/^None\b/.test(text)) probs.push('the roster holds no Charter class for this item; the Defect class line must begin "None" and say why');
    }
    if (L.Rules) {
        const codes = L.Rules.match(CODE_RE_G) || [];
        for (const c of codes) if (!declared.all.has(c)) probs.push(`the Rules line cites ${c}, which the Charter does not declare`);
        for (const c of row.rules) if (!codes.includes(c)) probs.push(`the Rules line omits ${c}, which the detector's header enforces`);
    }
    return probs;
}

// The entries of TIMELINE.md for this mandate: { ticket, item, section }.
function mandateEntries(timeline) {
    const out = [], re = /^## (T\d+) — Item ([A-Z]) of the 2026-10-10 mandate/gm, heads = [...timeline.matchAll(re)];
    heads.forEach((m, i) => {
        const start = m.index, nextHead = timeline.indexOf('\n## ', start + 1);
        out.push({ ticket: m[1], item: m[2], section: timeline.slice(start, nextHead < 0 ? timeline.length : nextHead) });
    });
    return out;
}

function checkCompleteness(entries, rows) {
    const probs = [], byItem = new Map(entries.map(e => [e.item, e])), rowItems = new Set(rows.map(r => r.item));
    for (const e of entries) if (!rowItems.has(e.item)) probs.push(`TIMELINE.md has the entry for item ${e.item} (${e.ticket}) and the roster has no row for it: a landed item with no detector held`);
    for (const r of rows) {
        const e = byItem.get(r.item);
        if (!e) probs.push(`the roster has item ${r.item} and TIMELINE.md has no entry for it`);
        else if (e.ticket !== r.ticket) probs.push(`item ${r.item}: the roster says ${r.ticket}, TIMELINE.md says ${e.ticket}`);
    }
    return probs;
}

// ───────────────────────────────────────── running a detector ─────────────────────────────────────────
function runDetector(file) {
    return new Promise(resolve => {
        const started = Date.now();
        const p = spawn(process.execPath, [path.join(HARNESS, file)], { cwd: HARNESS, env: process.env });
        let out = '', timedOut = false;
        const t = setTimeout(() => { timedOut = true; p.kill('SIGKILL'); }, RUN_TIMEOUT_MS);
        p.stdout.on('data', d => { out += d; });
        p.stderr.on('data', d => { out += d; });
        p.on('close', code => { clearTimeout(t); resolve({ code, timedOut, out, ms: Date.now() - started }); });
        p.on('error', e => { clearTimeout(t); resolve({ code: 127, timedOut: false, out: String(e), ms: Date.now() - started }); });
    });
}

// ───────────────────────────────────────── the probes: every pure check must be able to fail ─────────────────────────────────────────
function probes(declared) {
    const results = [];
    const probe = (label, got, want) => {
        const ok = want === 'clean' ? got.length === 0 : got.some(p => want.test(p)) ;
        results.push({ label, ok, detail: ok ? '' : `expected ${want === 'clean' ? 'no problem' : String(want)}; got ${JSON.stringify(got)}` });
    };
    const AT = '@';   // the synthetic headers are built, not written out, so this file's own source carries no tag but its real ones
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'conformance-probe-'));
    const write = (name, header) => fs.writeFileSync(path.join(dir, name), `/**\n${header.map(h => ' * ' + h).join('\n')}\n */\n`);
    const row = { item: 'X', ticket: 'T999', file: 'verify_probe_good.js', floor: 5, kind: 'behavioral', rules: ['R-INVARIANT-SINGLEDEF', 'R-SYSTEM-SCRIPT'], defect: 'DEFECT-DUPLICATE-REGISTRY' };
    write('verify_probe_good.js', [AT + 'enforces R-INVARIANT-SINGLEDEF', AT + 'enforces R-SYSTEM-SCRIPT', AT + 'detects DEFECT-DUPLICATE-REGISTRY']);
    write('verify_probe_lacks_rule.js', [AT + 'enforces R-INVARIANT-SINGLEDEF', AT + 'detects DEFECT-DUPLICATE-REGISTRY']);
    write('verify_probe_orphan_rule.js', [AT + 'enforces R-INVARIANT-SINGLEDEF', AT + 'enforces R-SYSTEM-SCRIPT', AT + 'enforces R-GOVERN-NO-SUCH-RULE', AT + 'detects DEFECT-DUPLICATE-REGISTRY']);
    write('verify_probe_lacks_class.js', [AT + 'enforces R-INVARIANT-SINGLEDEF', AT + 'enforces R-SYSTEM-SCRIPT']);
    write('verify_probe_orphan_class.js', [AT + 'enforces R-INVARIANT-SINGLEDEF', AT + 'enforces R-SYSTEM-SCRIPT', AT + 'detects DEFECT-DUPLICATE-REGISTRY', AT + 'detects DEFECT-NO-SUCH-CLASS']);
    write('verify_probe_principle.js', [AT + 'enforces R-INVARIANT-SINGLEDEF', AT + 'enforces R-SYSTEM-SCRIPT', AT + 'enforces P-GOVERN-GOODHART', AT + 'detects DEFECT-DUPLICATE-REGISTRY']);
    const enf = charterModel.readEnforcements(dir);
    fs.rmSync(dir, { recursive: true, force: true });
    const header = f => checkHeader(f, row, enf, declared);
    probe('header: correct tags conform', header('verify_probe_good.js'), 'clean');
    probe('header: a missing @enforces is found', header('verify_probe_lacks_rule.js'), /does not [@]enforces R-SYSTEM-SCRIPT/);
    probe('header: an @enforces of an undeclared rule is found', header('verify_probe_orphan_rule.js'), /R-GOVERN-NO-SUCH-RULE.*not a Rule the Charter declares/);
    probe('header: a missing @detects is found', header('verify_probe_lacks_class.js'), /does not [@]detects DEFECT-DUPLICATE-REGISTRY/);
    probe('header: a @detects of an undeclared class is found', header('verify_probe_orphan_class.js'), /DEFECT-NO-SUCH-CLASS.*not a defect class/);
    probe('header: an @enforces of a Principle is found (a Principle is not enforced by definition)', header('verify_probe_principle.js'), /P-GOVERN-GOODHART.*not a Rule/);
    probe('header: a roster row naming a rule the Charter lacks is found', checkHeader('verify_probe_good.js', Object.assign({}, row, { rules: ['R-GOVERN-NO-SUCH-RULE'] }), enf, declared), /roster says it enforces, is not a Rule/);

    probe('mechanism: a behavioral claim held by a text-only detector is found', checkMechanism('behavioral', "const t = fs.readFileSync('qr.html','utf8'); /resolveConfidence/.test(t)"), /never evaluates the page's code/);
    probe('mechanism: a mixed claim held by a text-only detector is found', checkMechanism('mixed', 'const t = readPage(); t.includes("x")'), /never evaluates/);
    probe('mechanism: a behavioral claim held by a detector that boots the page conforms', checkMechanism('behavioral', "const { JSDOM } = require('jsdom'); new JSDOM(html, { runScripts: 'dangerously' })"), 'clean');
    probe('mechanism: a behavioral claim held by a detector that runs the code in a vm context conforms', checkMechanism('behavioral', 'vm.runInContext(code, sb)'), 'clean');
    probe('mechanism: a source-shape claim needs no evaluation', checkMechanism('source-shape', 'const t = readPage();'), 'clean');
    probe('mechanism: an unknown kind is found', checkMechanism('vibes', ''), /not one of/);

    const good = n => `[x] ${n} passed, 0 failed (of ${n} checks)`;
    probe('run: a clean summary at the floor conforms', checkRun(row, { code: 0, timedOut: false, out: good(5) }), 'clean');
    probe('run: a summary of zero checks is found', checkRun(row, { code: 0, timedOut: false, out: good(0) }), /reports 0 checks; the floor is 5/);
    probe('run: a detector that lost checks (below the floor) is found', checkRun(row, { code: 0, timedOut: false, out: good(4) }), /floor is 5/);
    probe('run: a failing check is found', checkRun(row, { code: 1, timedOut: false, out: '[x] 4 passed, 2 failed (of 6 checks)' }), /2 of its 6 checks fail/);
    probe('run: an output with no summary is found', checkRun(row, { code: 0, timedOut: false, out: 'all good' }), /printed no/);
    probe('run: a non-zero exit under a clean summary is found', checkRun(row, { code: 1, timedOut: false, out: good(5) }), /exited 1/);
    probe('run: a summary that does not add up is found', checkRun(row, { code: 0, timedOut: false, out: '[x] 5 passed, 0 failed (of 9 checks)' }), /does not add up/);
    probe('run: a timeout is found', checkRun(row, { code: null, timedOut: true, out: '' }), /did not finish/);

    probe('registration: a listed detector conforms', checkRegistered('a.js', { test_files: ['a.js'] }), 'clean');
    probe('registration: an unlisted detector is found', checkRegistered('a.js', { test_files: ['b.js'] }), /not listed in MASTER/);

    const block = (over = {}) => {
        const f = Object.assign({
            Rationale: 'Two private tables ranked the `tiers` and a third `TIER_ORDER` repeated them, so every read had to survive its own table having a gap.',
            Endpoint: 'One frozen `TIER_RANK` in the pricing engine, read everywhere the tiers are compared.',
            'Defect class': '`DEFECT-DUPLICATE-REGISTRY`.', Detector: '`verify_probe_good.js`.', Rules: '`R-INVARIANT-SINGLEDEF`, `R-SYSTEM-SCRIPT`.',
        }, over);
        return '## T999 — Item X of the 2026-10-10 mandate: x\n\n**Ledger (R-GOVERN-TRANSITION: ...).**\n\n' + LABELS.filter(l => f[l] !== null).map(l => `- **${l}.** ${f[l]}`).join('\n') + '\n';
    };
    probe('ledger: a complete block conforms', checkLedger(block(), row, declared), 'clean');
    probe('ledger: no entry at all is found', checkLedger(null, row, declared), /no entry headed/);
    probe('ledger: an entry with no block is found', checkLedger('## T999 — Item X of the 2026-10-10 mandate: x\n\nprose only\n', row, declared), /no Ledger block/);
    probe('ledger: a block with no Endpoint is found', checkLedger(block({ Endpoint: null }), row, declared), /no "Endpoint\." line/);
    probe('ledger: a placeholder Rationale is found', checkLedger(block({ Rationale: 'TBD' }), row, declared), /Rationale is a placeholder/);
    probe('ledger: an abstract Rationale (names nothing) is found', checkLedger(block({ Rationale: 'The old shape forced consumers to work around it in several places, which was wrong and hard to maintain over time.' }), row, declared), /Rationale names no thing/);
    probe('ledger: an abstract Endpoint (names nothing) is found', checkLedger(block({ Endpoint: 'A single cleaner structure now exists where there used to be several of them in the code.' }), row, declared), /Endpoint names no thing/);
    probe("ledger: another detector's name is found", checkLedger(block({ Detector: '`verify_other.js`.' }), row, declared), /roster holds verify_probe_good\.js/);
    probe('ledger: a class the Charter does not declare is found', checkLedger(block({ 'Defect class': '`DEFECT-NO-SUCH-CLASS`.' }), row, declared), /DEFECT-NO-SUCH-CLASS, which the Charter does not declare/);
    probe('ledger: a different class from the roster\'s is found', checkLedger(block({ 'Defect class': '`DEFECT-DUPLICATE-PARSER`.' }), row, declared), /should lead with DEFECT-DUPLICATE-REGISTRY/);
    probe('ledger: "None" where the roster holds a class is found', checkLedger(block({ 'Defect class': 'None declared.' }), row, declared), /should lead with/);
    probe('ledger: a class where the roster holds none is found', checkLedger(block({ 'Defect class': '`DEFECT-DUPLICATE-REGISTRY`.' }), Object.assign({}, row, { defect: null }), declared), /must begin "None"/);
    probe('ledger: "None" where the roster holds none conforms', checkLedger(block({ 'Defect class': 'None declared (the Charter has no class for this).' }), Object.assign({}, row, { defect: null }), declared), 'clean');
    probe('ledger: a rule the Charter does not declare is found', checkLedger(block({ Rules: '`R-INVARIANT-SINGLEDEF`, `R-SYSTEM-SCRIPT`, `R-GOVERN-NO-SUCH-RULE`.' }), row, declared), /R-GOVERN-NO-SUCH-RULE, which the Charter does not declare/);
    probe("ledger: a rule the detector enforces but the entry omits is found", checkLedger(block({ Rules: '`R-INVARIANT-SINGLEDEF`.' }), row, declared), /omits R-SYSTEM-SCRIPT/);

    const tl = '## T1 — x\n\n## T159 — Item B of the 2026-10-10 mandate: b\n\nbody b\n\n## T160 — Item C of the 2026-10-10 mandate: c\n\nbody c\n\n## T20 — y\n';
    const ents = mandateEntries(tl);
    probe('entries: the mandate headings are found and bounded by the next heading', ents.length === 2 && ents[0].item === 'B' && !ents[0].section.includes('body c') && ents[1].section.includes('body c') ? [] : ['mis-parsed'], 'clean');
    probe('completeness: a landed item with no roster row is found', checkCompleteness(ents, [{ item: 'B', ticket: 'T159' }]), /item C.*no row for it/);
    probe('completeness: a roster row with no entry is found', checkCompleteness(ents, [{ item: 'B', ticket: 'T159' }, { item: 'C', ticket: 'T160' }, { item: 'D', ticket: 'T161' }]), /roster has item D and TIMELINE\.md has no entry/);
    probe('completeness: a ticket that disagrees is found', checkCompleteness(ents, [{ item: 'B', ticket: 'T159' }, { item: 'C', ticket: 'T161' }]), /roster says T161, TIMELINE\.md says T160/);
    probe('completeness: matching roster and entries conform', checkCompleteness(ents, [{ item: 'B', ticket: 'T159' }, { item: 'C', ticket: 'T160' }]), 'clean');
    return results;
}

// ───────────────────────────────────────── main ─────────────────────────────────────────
let pass = 0, fail = 0;
const check = (label, probs, detail) => {
    const arr = Array.isArray(probs) ? probs : probs ? [] : [detail || 'failed'];
    if (arr.length === 0) { pass++; console.log(`  ✓ ${label}`); }
    else { fail++; console.log(`  ✗ ${label}`); arr.forEach(p => console.log(`      ${p}`)); }
};

async function main() {
    if (process.argv.includes('--list')) {
        for (const r of [...ROSTER, SELF_ROW]) console.log(`${r.item}  ${r.ticket}  ${(r.kind || 'meta').padEnd(12)} ${r.file.padEnd(40)} floor ${String(r.floor || '-').padStart(3)}  ${r.rules.join(', ')}${r.defect ? '  @detects ' + r.defect : ''}`);
        return 0;
    }
    const charterPath = path.join(REPO_ROOT, 'PROJECT_CHARTER.html');
    if (!fs.existsSync(charterPath)) { console.error(`✗ Charter not found: ${charterPath}`); return 1; }
    const model = charterModel.loadCharter(charterPath), declared = declaredOf(model);
    const enf = charterModel.readEnforcements(HARNESS);
    const master = JSON.parse(fs.readFileSync(path.join(HARNESS, 'MASTER_TEST_SUITE.json'), 'utf8'));
    const timeline = fs.readFileSync(path.join(REPO_ROOT, 'TIMELINE.md'), 'utf8');

    console.log('[architectural conformance]');
    console.log('\n0. NON-VACUITY: every pure check below is run on synthetic input and must give the verdict stated');
    check('the Charter is read (rules, defect classes declared)', declared.rules.size >= 40 && declared.classes.size >= 8, `${declared.rules.size} rules, ${declared.classes.size} classes`);
    check('the roster is the six landed items B to G, each once, with a known kind and a floor', (() => {
        const items = ROSTER.map(r => r.item).join('');
        const p = [];
        if (items !== 'BCDEFG') p.push(`items are "${items}", expected "BCDEFG"`);
        if (new Set(ROSTER.map(r => r.file)).size !== ROSTER.length) p.push('two rows share a detector');
        for (const r of ROSTER) { if (!KINDS.includes(r.kind)) p.push(`${r.item}: unknown kind`); if (!(r.floor > 0)) p.push(`${r.item}: no floor`); if (!r.rules.length) p.push(`${r.item}: no rules`); }
        return p;
    })());
    const pr = probes(declared);
    for (const r of pr) check(`probe: ${r.label}`, r.ok, r.detail);

    // start every detector at once (they are independent: each reads the tree and prints a summary), then report row by row
    const present = ROSTER.filter(r => fs.existsSync(path.join(HARNESS, r.file)));
    const runs = new Map(present.map(r => [r.file, runDetector(r.file)]));

    const entries = mandateEntries(timeline);
    const sectionOf = row => (entries.find(e => e.item === row.item) || {}).section ?? null;
    const summary = [];
    for (const row of ROSTER) {
        console.log(`\n${row.item}. ${row.ticket}  ${row.claim}   [${row.kind}; ${row.file}]`);
        const exists = fs.existsSync(path.join(HARNESS, row.file));
        check(`the detector exists`, exists ? [] : [`${row.file} is missing`]);
        check(`it is listed in MASTER_TEST_SUITE.json`, checkRegistered(row.file, master));
        check(`its header tags are real: @enforces ${row.rules.join(', ')}${row.defect ? '; @detects ' + row.defect : ''}`, exists ? checkHeader(row.file, row, enf, declared) : ['no detector to read']);
        check(`its mechanism fits the claim (${row.kind}, P-GOVERN-GOODHART)`, exists ? checkMechanism(row.kind, fs.readFileSync(path.join(HARNESS, row.file), 'utf8')) : ['no detector to read']);
        check(`its ledger entry carries rationale, endpoint, class, detector, rules (R-GOVERN-TRANSITION)`, checkLedger(sectionOf(row), row, declared));
        let verdict = 'no detector';
        if (exists) {
            const run = await runs.get(row.file);
            const probs = checkRun(row, run);
            const m = [...run.out.matchAll(/(\d+) passed, (\d+) failed \(of (\d+) checks\)/g)].pop();
            verdict = m ? `${m[1]} of ${m[3]} pass` : 'no summary';
            check(`it runs green: ${verdict}, ${(run.ms / 1000).toFixed(1)} s (floor ${row.floor})`, probs);
            if (probs.length) {
                const lines = run.out.split('\n').filter(l => /^\s+✗/.test(l));
                console.log(`      its failing checks (${lines.length}), first ${Math.min(lines.length, 12)}:`);
                lines.slice(0, 12).forEach(l => console.log(`      ${l.trim().slice(0, 170)}`));
            }
        } else check('it runs green', ['no detector to run']);
        summary.push({ row, verdict });
    }

    console.log(`\nH. ${SELF_ROW.ticket}  ${SELF_ROW.claim}   [${SELF}]`);
    check(`its header tags are real: @enforces ${SELF_ROW.rules.join(', ')}`, checkHeader(SELF, SELF_ROW, enf, declared));
    check(`it is listed in MASTER_TEST_SUITE.json`, checkRegistered(SELF, master));
    check(`its ledger entry carries rationale, endpoint, class, detector, rules (R-GOVERN-TRANSITION)`, checkLedger(sectionOf(SELF_ROW), SELF_ROW, declared));

    console.log('\nCOMPLETENESS (both ways)');
    check(`every "Item X of the 2026-10-10 mandate" entry in TIMELINE.md has a roster row, and every row has its entry`, checkCompleteness(entries, [...ROSTER, SELF_ROW]));
    check('TIMELINE.md is read (the mandate entries are found)', entries.length >= 7, `${entries.length} entries found, expected 7 (B to H)`);

    console.log('\n' + 'item'.padEnd(5) + 'ticket'.padEnd(7) + 'kind'.padEnd(14) + 'detector'.padEnd(40) + 'verdict');
    for (const s of summary) console.log(String(s.row.item).padEnd(5) + s.row.ticket.padEnd(7) + s.row.kind.padEnd(14) + s.row.file.padEnd(40) + s.verdict);
    console.log(`\n[architectural conformance] ${pass} passed, ${fail} failed (of ${pass + fail} checks)`);
    return fail ? 1 : 0;
}
main().then(code => process.exit(code), e => { console.error(e); process.exit(1); });
