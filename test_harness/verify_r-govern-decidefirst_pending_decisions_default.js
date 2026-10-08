#!/usr/bin/env node
/**
 * verify_r-govern-decidefirst_pending_decisions_default.js -- the linter behind R-GOVERN-DECIDEFIRST (PROJECT_CHARTER.html, Partial; operator ruling #105(3)).
 *
 * @enforces R-GOVERN-DECIDEFIRST
 *
 * THE RULE. Before a decision is filed as needing the operator, its ledger entry carries the measurement that would settle it and the decision the
 * agent will take if it is not answered ("Default if unanswered"). Only a question that turns on information the agent cannot obtain (customer intent,
 * business appetite, legal standing) may be deferred without a measurement, and the entry says which. G-GOVERN-AUTONOMY governs where an older
 * standing instruction (T80: "business calls stay excluded even under explicit trust") disagrees, for anything reversible and documented.
 *
 * WHAT THIS CHECKS (the Partial half: the part a machine can see).
 *   Every OPEN entry in PENDING_DECISIONS.md that is not grandfathered carries a "Default if unanswered" line with real content after it.
 *     - An entry is a numbered heading (`### #N -- ...`) or a deferred item (`**D-<scope>-N -- ...**`).
 *     - It is OPEN when its heading carries the open marker (a heading that is part closed and part open is open); a deferred item is open
 *       until its text says RESOLVED.
 *     - GRANDFATHERED: numbered entries up to #119 and the Phase A deferred items (D-C11-*, D-A2b-*, D-A4-*), which were filed before the Rule.
 *       They leave the grandfathered set by being closed; nothing may be added to it. Every entry filed after the Rule is held to it.
 *     - "Real content": more than a bare option letter or a placeholder (none, n/a, TBD, ?).
 *   What it cannot check, and says so: that the measurement was the right one, or that the default is the sensible one. That is why the Rule is Partial.
 *
 * NON-VACUITY (a check that cannot fail proves nothing). The linter is one pure function over the ledger text. Before it is trusted on the real ledger
 * it is run on nine synthetic ledgers, each of which must produce exactly the verdict stated (a new open entry with no default; with one; with an empty
 * one; with a placeholder; a new deferred item with none; a closed entry with none; a half-open heading with none; a grandfathered open entry with none;
 * a default belonging to the NEXT entry must not satisfy this one), and the real ledger must parse to a population large enough to mean something.
 *
 * Exit: 0 = the ledger obeys the Rule; 1 = an open entry without a default, or a linter that cannot fail.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.dirname(__dirname);
const LEDGER = path.join(REPO_ROOT, 'PENDING_DECISIONS.md');
const LAST_GRANDFATHERED_NUMBER = 119;                           // the last numbered entry filed before the Rule (T156)
const GRANDFATHERED_DEFERRED_PREFIXES = ['D-C11-', 'D-A2b-', 'D-A4-'];   // the Phase A deferred items (T155)
const PLACEHOLDERS = /^(none|n\/a|na|tbd|todo|unknown|\?+|-+|\.+)\b/i;

let pass = 0, fail = 0;
const ok = (m) => { pass++; console.log('  ✓ ' + m); };
const bad = (m, d) => { fail++; console.log('  ✗ ' + m + (d ? '\n      ' + String(d).split('\n').join('\n      ') : '')); };
const check = (cond, okMsg, badMsg, detail) => (cond ? ok(okMsg) : bad(badMsg || okMsg, detail));

// Split the ledger into entries: { id, kind, heading, body, open, grandfathered }.
function parseLedger(text) {
    const lines = text.split(/\r?\n/);
    const entries = [];
    let cur = null;
    const flush = () => { if (cur) { cur.body = cur.lines.join('\n'); delete cur.lines; entries.push(cur); cur = null; } };
    for (const line of lines) {
        let m;
        if ((m = /^###\s+#(\d+)\b(.*)$/.exec(line))) {
            flush();
            const n = Number(m[1]);
            // Open when the heading says so. A heading that is partly closed and partly open (the follow-ups are open) is open.
            cur = { id: '#' + n, kind: 'numbered', number: n, heading: line, lines: [], open: line.includes('🟡'), grandfathered: n <= LAST_GRANDFATHERED_NUMBER };
        } else if ((m = /^\*\*(D-[A-Za-z0-9]+-\d+)\b/.exec(line))) {
            flush();
            cur = { id: m[1], kind: 'deferred', heading: line.slice(0, 120), lines: [line], open: true, grandfathered: GRANDFATHERED_DEFERRED_PREFIXES.some(p => m[1].startsWith(p)) };
        } else if (/^#{1,3}\s/.test(line) || /^---+\s*$/.test(line)) {
            flush();
        } else if (cur) {
            cur.lines.push(line);
        }
    }
    flush();
    for (const e of entries) if (e.kind === 'deferred' && /\bRESOLVED\b/.test(e.body.slice(0, 400))) e.open = false;
    return entries;
}

// The text that follows "Default if unanswered" in this entry, reduced to the words.
function defaultOf(entry) {
    const m = /Default if unanswered/i.exec(entry.body);
    if (!m) return null;
    // The default is the rest of ITS paragraph: a blank line ends it, so the next paragraph's prose cannot stand in for an empty default.
    const rest = entry.body.slice(m.index + m[0].length).split(/\n[ \t]*\n/)[0].slice(0, 600);
    return rest.replace(/[*_`:]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function lintLedger(text) {
    const entries = parseLedger(text);
    const problems = [];
    for (const e of entries) {
        if (!e.open || e.grandfathered) continue;
        const d = defaultOf(e);
        if (d === null) { problems.push(`${e.id} is open and has no "Default if unanswered" line (R-GOVERN-DECIDEFIRST)`); continue; }
        // A bare option letter ("(C).") is not a decision; the words after it are. Strip a leading "(X)" / "X." before measuring.
        const words = d.replace(/^\(?[A-Za-z]\)?[.:]?\s+/, '').replace(/[^A-Za-z0-9 ]+/g, ' ').trim();
        if (PLACEHOLDERS.test(d) || words.length < 15) problems.push(`${e.id}: the "Default if unanswered" line has no real content ("${d.slice(0, 40)}")`);
    }
    return { entries, problems };
}

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
console.log('=== 0. The linter can fail (non-vacuity) ===');
{
    const newOpen = (n, body) => `### #${n} — 🟡 OPEN, T999: a synthetic decision\n${body}\n`;
    const GOOD = '**Default if unanswered:** ship the narrower option now and revisit when the catalog changes.';
    const cases = [
        ['a new open entry with no default is flagged',                 newOpen(9001, 'Some finding.'),                                                        p => p.length === 1 && /#9001 is open and has no/.test(p[0])],
        ['a new open entry with a default passes',                      newOpen(9002, GOOD),                                                                   p => p.length === 0],
        ['a new open entry with an EMPTY default is flagged',           newOpen(9003, '**Default if unanswered:**\n\nMore text that is not the default.'),     p => p.length === 1 && /#9003/.test(p[0])],
        ['a new open entry with a placeholder default is flagged',      newOpen(9004, '**Default if unanswered:** TBD'),                                       p => p.length === 1 && /#9004/.test(p[0])],
        ['a new deferred item with no default is flagged',              'Intro.\n\n**D-B1-1 -- a new deferred thing.** It needs a call.\n',                    p => p.length === 1 && /D-B1-1/.test(p[0])],
        ['a CLOSED entry with no default passes',                       '### #9005 — ✅ CLOSED, T999: done\nNothing open here.\n',                              p => p.length === 0],
        ['a half-closed, half-open heading with no default is flagged', '### #9006 — ✅ CLOSED (structure) / 🟡 OPEN (follow-ups), T999: x\nFollow-ups remain.\n', p => p.length === 1 && /#9006/.test(p[0])],
        ['a grandfathered open entry with no default passes',           '### #50 — 🟡 OPEN, T50: an old decision\nNo default was ever written.\n',              p => p.length === 0],
        ['a default belonging to the NEXT entry does not satisfy this one', newOpen(9007, 'No default here.') + '\n' + newOpen(9008, GOOD),                     p => p.length === 1 && /#9007/.test(p[0])],
        ['a resolved deferred item passes without a default',           '**D-B1-2 -- RESOLVED, T999: it was decided.** The operator ruled.\n',                 p => p.length === 0],
    ];
    for (const [label, text, expect] of cases) {
        const { problems } = lintLedger(text);
        check(expect(problems), `linter: ${label}`, `linter: ${label} -- got ${JSON.stringify(problems)}`);
    }
}

console.log('\n=== 1. The real ledger ===');
{
    if (!fs.existsSync(LEDGER)) { bad('PENDING_DECISIONS.md is missing'); }
    else {
        const text = fs.readFileSync(LEDGER, 'utf8');
        const { entries, problems } = lintLedger(text);
        const numbered = entries.filter(e => e.kind === 'numbered'), deferred = entries.filter(e => e.kind === 'deferred');
        const open = entries.filter(e => e.open), held = open.filter(e => !e.grandfathered);
        check(numbered.length >= 100, `the parser found ${numbered.length} numbered entries (floor 100: the ledger is being read)`, `only ${numbered.length} numbered entries found (floor 100): the ledger is not being read`);
        check(deferred.length >= 10, `the parser found ${deferred.length} deferred items (floor 10)`, `only ${deferred.length} deferred items found (floor 10)`);
        check(open.length >= 25, `${open.length} entries are open (floor 25)`, `only ${open.length} entries read as open (floor 25): the open marker is not being recognised`);
        check(problems.length === 0,
            `every open entry filed after the Rule carries a default: ${held.length} held to it, ${open.length - held.length} grandfathered open`,
            `${problems.length} open entr${problems.length === 1 ? 'y' : 'ies'} without a default`, problems.join('\n'));
        console.log(`    ℹ  grandfathered by number (<= #${LAST_GRANDFATHERED_NUMBER}) or Phase A deferred prefix: ${open.length - held.length} open entries leave that list as they are closed.`);
    }
}

console.log(`\n[R-GOVERN-DECIDEFIRST ledger linter] ${pass} passed, ${fail} failed (of ${pass + fail} checks)`);
process.exit(fail > 0 ? 1 : 0);
