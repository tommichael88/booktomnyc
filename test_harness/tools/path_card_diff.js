#!/usr/bin/env node
/**
 * tools/path_card_diff.js -- what a customer is asked by each way of tapping through the catalog, before and after a change (T191, #194).
 *
 *   node test_harness/tools/path_card_diff.js <base_qr.html> <head_qr.html> [--groups id,id] [--json out.json]
 *
 * render_diff.js drives every SERVICE directly; it never taps through the picker, so a change in what the picker's path tells the engine (#194: the groups walked, the tile tapped) cannot show in it. This walks
 * every group of the catalog, every picker level and every tile on BOTH builds (_catalog_walk.js: the same walk verify_state_ignorance.js judges), records for each card a tap opens the service it opened, the
 * questions it shows (each with the options offered) and the answers already recorded, and prints every card that differs: options the head no longer offers, answers the head records, questions it adds or drops.
 * A card is identified by its tap path. A card on one build only is reported as such. Exit 0 always: it measures, the change's ledger entry says what was meant.
 */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = process.env.BTNYC_ROOT ? path.resolve(process.env.BTNYC_ROOT) : path.resolve(__dirname, '..', '..');
const { readPage } = require('../_page.js');
const { boot, walk } = require('../_catalog_walk.js');

const args = process.argv.slice(2);
const flag = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const positional = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--')));
if (positional.length < 2) { console.error('usage: path_card_diff.js <base_qr.html> <head_qr.html> [--groups id,id] [--json out.json]'); process.exit(2); }
const [BASE, HEAD] = positional.map(p => path.resolve(p));
const onlyGroups = flag('--groups') ? flag('--groups').split(',') : undefined;
const DB = JSON.parse(fs.readFileSync(path.join(ROOT, 'btnyc.json'), 'utf8'));

async function cards(qr) {
    const page = await boot({ db: DB, html: readPage(qr, ROOT) });
    const leaves = await walk(page, { onlyGroups });
    const map = new Map();
    for (const l of leaves) {
        const key = l.where + ' | ' + l.entity;
        map.set(key, { where: l.where, entity: l.entity, answers: l.answers || {}, open: (l.open || []).map(q => ({ mod: q.mod, options: q.options || [] })), mods: l.mods || [] });
    }
    page.w.close();
    return { map, leaves: leaves.length, errors: page.errors.length };
}

(async () => {
    const base = await cards(BASE), head = await cards(HEAD);
    const diffs = [];
    for (const [k, b] of base.map) {
        const h = head.map.get(k);
        if (!h) { diffs.push({ key: k, kind: 'only on base' }); continue; }
        const d = { key: k, kind: 'changed', dropped: [], added: [], answers: [], questions: [] };
        const bq = new Map(b.open.map(q => [q.mod, q.options])), hq = new Map(h.open.map(q => [q.mod, q.options]));
        for (const [mod, bo] of bq) {
            if (!hq.has(mod)) { d.questions.push(`${mod} no longer asked`); continue; }
            const ho = hq.get(mod);
            for (const o of bo) if (!ho.includes(o)) d.dropped.push(`${mod}: -${o}`);
            for (const o of ho) if (!bo.includes(o)) d.added.push(`${mod}: +${o}`);
        }
        for (const mod of hq.keys()) if (!bq.has(mod)) d.questions.push(`${mod} newly asked`);
        for (const m of new Set([...Object.keys(b.answers), ...Object.keys(h.answers)])) if (JSON.stringify(b.answers[m]) !== JSON.stringify(h.answers[m])) d.answers.push(`${m}: ${JSON.stringify(b.answers[m])} -> ${JSON.stringify(h.answers[m])}`);
        if (d.dropped.length || d.added.length || d.answers.length || d.questions.length) diffs.push(d);
    }
    for (const k of head.map.keys()) if (!base.map.has(k)) diffs.push({ key: k, kind: 'only on head' });
    console.log(`[path_card_diff] base ${base.leaves} cards, head ${head.leaves} cards | page errors base/head: ${base.errors}/${head.errors} | cards that differ: ${diffs.length}`);
    for (const d of diffs) {
        console.log('  ' + d.kind.toUpperCase() + '  ' + d.key);
        for (const x of (d.dropped || [])) console.log('      offered no more  ' + x);
        for (const x of (d.added || [])) console.log('      newly offered    ' + x);
        for (const x of (d.answers || [])) console.log('      answer           ' + x);
        for (const x of (d.questions || [])) console.log('      question         ' + x);
    }
    if (flag('--json')) fs.writeFileSync(flag('--json'), JSON.stringify({ base: BASE, head: HEAD, baseCards: base.leaves, headCards: head.leaves, diffs }, null, 1));
    process.exit(0);
})().catch(e => { console.error(e); process.exit(2); });
