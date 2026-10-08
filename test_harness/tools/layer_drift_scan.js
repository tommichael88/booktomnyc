#!/usr/bin/env node
/**
 * tools/layer_drift_scan.js -- where did the layering drift, and which version is closest to the standard?
 *
 * Runs the SAME analyzer that gates R-INVARIANT-BOUNDARY (../_ui_boundary.js) over every historical
 * version of qr.html and prints one row per version, oldest first. Read the trend: the row where
 * forbidden references start climbing and UIRenderer starts growing non-DOM functions is the U-turn.
 *
 * USAGE (run from anywhere; --repo defaults to the current directory)
 *
 *   # every commit that touched qr.html, oldest first
 *   node test_harness/tools/layer_drift_scan.js --git qr.html
 *
 *   # same, limited to a window
 *   node test_harness/tools/layer_drift_scan.js --git qr.html --since 2026-06-15 --until 2026-09-30
 *
 *   # turn a SHA-256 *content* hash into the commit that contains it
 *   #   (the 64-hex values in operator notes are sha256sum of the file, NOT git blob ids)
 *   node test_harness/tools/layer_drift_scan.js --git qr.html --find-hash 70ae5177bbbf6c0e
 *
 *   # plain local files (no git)
 *   node test_harness/tools/layer_drift_scan.js --files qr.html _qr.html
 *
 *   # long history: look at every 10th commit first, then zoom in with --since/--until
 *   node test_harness/tools/layer_drift_scan.js --git qr.html --step 10
 *
 *   # also write a CSV
 *   ... --csv drift.csv
 *
 * COLUMNS
 *   blocks_bad   non-empty <script> blocks that do not compile. >0 means the version cannot run.
 *   mods         of the 7 module blocks (pricing, nlp, orchestrator, UIRenderer, AppController,
 *                appReducer, store) how many are present.
 *   ui_fns       top-level functions inside the UIRenderer block.
 *   refs         forbidden references inside UIRenderer (charter tier + adjacent tier; see the test header).
 *   owners       distinct UIRenderer functions holding those references.
 *   no_dom       UIRenderer functions with no DOM contact at all (non-gating census figure).
 *
 * The summary at the end names the best version by layer discipline among versions that COMPILE
 * (usable as a baseline) and, separately, the best overall (which may not run). A version that scores
 * well by deleting code its callers still need is exactly what "blocks_bad" and the test suite are
 * there to expose -- do not pick a baseline from this table alone.
 *
 * Versions that predate module headers have no UIRenderer block; their UI columns print "-".
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const { splitScriptBlocks, findModuleBlock, tryParseJs, MODULE_NAMES } = require('../_qr_blocks.js');
const { analyze, gating } = require('../_ui_boundary.js');

// ─── args ───────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const opt = (name, dflt) => { const i = argv.indexOf(name); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : dflt; };
const flag = name => argv.includes(name);
const listAfter = name => { const i = argv.indexOf(name); if (i < 0) return []; const out = []; for (let j = i + 1; j < argv.length && !argv[j].startsWith('--'); j++) out.push(argv[j]); return out; };

const repo = path.resolve(opt('--repo', process.cwd()));
const gitPath = opt('--git', null);
const files = listAfter('--files');
const findHash = opt('--find-hash', null);
const csvOut = opt('--csv', null);
const since = opt('--since', null);
const until = opt('--until', null);
const step = Math.max(1, parseInt(opt('--step', '1'), 10) || 1);

if (!gitPath && !files.length) {
    console.error('usage: layer_drift_scan.js --git <path-in-repo> [--repo dir] [--since d] [--until d] [--find-hash hex] [--csv out]\n' +
        '       layer_drift_scan.js --files a.html b.html ... [--csv out]');
    process.exit(2);
}

const git = (...a) => execFileSync('git', ['-C', repo, ...a], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
const gitBuf = (...a) => execFileSync('git', ['-C', repo, ...a], { maxBuffer: 256 * 1024 * 1024 });

// ─── per-version measurement ────────────────────────────────────────────
function measure(html) {
    const blocks = splitScriptBlocks(html);
    const nonEmpty = blocks.filter(b => b.src.trim());
    let bad = 0;
    for (const b of nonEmpty) if (tryParseJs(b.src, b.startLine).error) bad++;
    const mods = MODULE_NAMES.filter(m => findModuleBlock(blocks, m)).length;
    const row = { blocks: nonEmpty.length, blocks_bad: bad, mods, ui_fns: null, refs: null, owners: null, no_dom: null, charter: null, adjacent: null };
    const ui = findModuleBlock(blocks, 'UIRenderer.js');
    if (ui) {
        const p = tryParseJs(ui.src, ui.startLine);
        if (!p.error) {
            const r = analyze(ui.src, { startLine: ui.startLine });
            const gated = r.violations.filter(gating);
            row.ui_fns = r.functions.length;
            row.refs = gated.length;
            row.charter = gated.filter(v => v.tier === 'charter').length;
            row.adjacent = gated.filter(v => v.tier === 'adjacent').length;
            row.owners = new Set(gated.map(v => `${v.owner}@${v.ownerLine}`)).size;
            row.no_dom = r.functions.filter(f => f.domTouches === 0).length;
        } else row.ui_note = 'UIRenderer block does not compile';
    }
    return row;
}

// ─── gather versions ────────────────────────────────────────────────────
const versions = [];
if (gitPath) {
    const args = ['log', '--reverse', '--format=%H%x09%cs%x09%s'];
    if (since) args.push(`--since=${since}`);
    if (until) args.push(`--until=${until}`);
    args.push('--', gitPath);
    let lines = git(...args).split('\n').filter(Boolean);
    // --step N keeps every Nth commit, always including the oldest and the newest.
    if (step > 1) lines = lines.filter((_, i) => i % step === 0 || i === lines.length - 1);
    for (const l of lines) {
        const [sha, date, ...subj] = l.split('\t');
        let buf;
        try { buf = gitBuf('show', `${sha}:${gitPath}`); } catch (e) { continue; } // deleted/renamed at that commit
        versions.push({ label: sha.slice(0, 8), sha, date, subject: subj.join('\t'), buf });
    }
} else {
    for (const f of files) {
        const buf = fs.readFileSync(f);
        versions.push({ label: path.basename(f), sha: null, date: fs.statSync(f).mtime.toISOString().slice(0, 10), subject: '', buf });
    }
}

// ─── find-hash mode ─────────────────────────────────────────────────────
if (findHash) {
    const want = findHash.toLowerCase();
    const hits = versions.filter(v => crypto.createHash('sha256').update(v.buf).digest('hex').startsWith(want));
    if (!hits.length) { console.log(`no version of ${gitPath || 'the given files'} has a sha256 starting ${want} (scanned ${versions.length})`); process.exit(1); }
    hits.forEach(h => console.log(`${h.sha || h.label}  ${h.date}  ${h.subject}`));
    process.exit(0);
}

// ─── table ──────────────────────────────────────────────────────────────
const rows = versions.map((v, i) => {
    if (versions.length > 20) process.stderr.write(`\rmeasuring ${i + 1}/${versions.length}`);
    const html = v.buf.toString('utf8');
    const m = measure(html);
    return Object.assign({
        version: v.label, date: v.date, kb: Math.round(v.buf.length / 1024),
        sha256: crypto.createHash('sha256').update(v.buf).digest('hex').slice(0, 12),
        subject: (v.subject || '').slice(0, 52),
    }, m);
});

const cols = [
    ['version', 9], ['date', 10], ['kb', 5], ['blocks_bad', 10], ['mods', 4], ['ui_fns', 6], ['refs', 5], ['owners', 6], ['no_dom', 6], ['sha256', 12], ['subject', 0],
];
const cell = (r, c) => (r[c] === null || r[c] === undefined ? '-' : String(r[c]));
if (versions.length > 20) process.stderr.write('\n');
console.log(cols.map(([c, w]) => (w ? c.padEnd(w) : c)).join(' '));
for (const r of rows) console.log(cols.map(([c, w]) => (w ? cell(r, c).padEnd(w) : cell(r, c))).join(' '));

// ─── summary ────────────────────────────────────────────────────────────
const scored = rows.filter(r => r.refs !== null);
const compiling = scored.filter(r => r.blocks_bad === 0);
const best = arr => arr.slice().sort((a, b) => a.refs - b.refs || a.no_dom - b.no_dom)[0];
console.log('');
if (!scored.length) {
    console.log('No version has a UIRenderer block that compiles, so no layer-discipline ranking is possible.');
} else {
    const b1 = best(scored), b2 = compiling.length ? best(compiling) : null;
    console.log(`best layer discipline overall          : ${b1.version} (${b1.date})  refs=${b1.refs} owners=${b1.owners} no_dom=${b1.no_dom}  blocks_bad=${b1.blocks_bad}${b1.blocks_bad ? '  <- CANNOT RUN' : ''}`);
    console.log(b2 ? `best among versions that all compile   : ${b2.version} (${b2.date})  refs=${b2.refs} owners=${b2.owners} no_dom=${b2.no_dom}` : 'no version has every script block compiling');
    const last = scored[scored.length - 1];
    console.log(`newest scored version                  : ${last.version} (${last.date})  refs=${last.refs} owners=${last.owners}`);
}
if (csvOut) {
    const header = cols.map(c => c[0]).concat(['charter', 'adjacent', 'blocks']);
    const esc = s => `"${String(s).replace(/"/g, '""')}"`;
    fs.writeFileSync(csvOut, [header.join(',')].concat(rows.map(r => header.map(h => esc(cell(r, h))).join(','))).join('\n') + '\n');
    console.log(`\nwrote ${csvOut}`);
}
