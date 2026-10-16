#!/usr/bin/env node
/**
 * verify_resolver_wiring.js -- the page with modules/resolver.js in it (T179): the resolver decides when it can, the page decides when it cannot, and the customer cannot tell which.
 *
 * @enforces R-SYSTEM-DEPLOY-CONTRACT
 * @enforces R-INVARIANT-PROVENANCE
 * @detects DEFECT-ARBITRATION
 *
 * verify_resolver_module.js proves the module against the legacy decision it replaces. This file proves the PAGE: it boots qr.html (assembled, as every page test does) under six different
 * artifacts and, in each, drives resolveComponentSymptomTap -- the function every component / symptom tile of the picker goes through -- at every (group, tile, action) point the catalog has,
 * recording what the page DID (opened a service card, listed a choice, opened the guided builder).
 *
 *   1. THE STATE        What the page says it did with the artifact (window.__resolverStatus): available, or unavailable with the reason.
 *   2. SAME BEHAVIOUR   The page's behaviour at every point is the same whether the resolver answered or not: artifact available == artifact missing == incompatible == stale == malformed.
 *   3. WHO DECIDED      With a usable artifact the resolver decided every tile that carries evidence; with none, the page decided every tile; a declared-symptom tile (no evidence) is the page's.
 *   4. A DRIFTED ARTIFACT  A compatible artifact that no longer lists what btnyc.json lists for ONE tile: the page decides that tile (and says so on the console), the resolver the rest.
 *   5. THE BOOT         A page whose artifact never arrives still boots and decides taps; the artifact is not on the boot's critical path.
 *   6. THE SOURCE       The page reads the artifact in one place, through the resolver; it does not read the authored source; the decision is taken as given (no `||`, `??`, or second source).
 */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = process.env.QR_ROOT || path.resolve(__dirname, '..');
const { JSDOM } = require(path.join(__dirname, 'node_modules', 'jsdom'));
const { readPage } = require('./_page.js');

let pass = 0, fail = 0;
const check = (name, ok, detail) => { if (ok) { pass++; console.log('  ✓ ' + name); } else { fail++; console.log('  ✗ ' + name + (detail ? '\n      ' + detail : '')); } };
const section = t => console.log('\n=== ' + t + ' ===');
const clone = o => JSON.parse(JSON.stringify(o));
const wait = ms => new Promise(r => setTimeout(r, ms));
const QR_PATH = path.join(ROOT, 'qr.html');
const HTML = readPage(QR_PATH);
const QR_TEXT = fs.readFileSync(QR_PATH, 'utf8');
const BTNYC = fs.readFileSync(path.join(ROOT, 'btnyc.json'), 'utf8');
const ART = JSON.parse(fs.readFileSync(path.join(ROOT, 'ssot', 'derived', 'btnyc_graph.json'), 'utf8'));
const CONTRACT = JSON.parse(fs.readFileSync(path.join(ROOT, 'schema', 'btnyc-interface-contract.json'), 'utf8'));

async function boot(variant) {
    const warns = [], errors = [], pageErrors = [];
    const dom = new JSDOM(HTML, {
        url: 'https://tommichael88.github.io/booktomnyc/qr.html', runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true,
        beforeParse(window) {
            window.fetch = async url => {
                const u = String(url);
                if (u.includes('btnyc.json')) return { ok: true, json: async () => JSON.parse(BTNYC) };
                if (u.includes('btnyc_graph.json')) return variant.hang ? new Promise(() => {}) : variant.artifact ? { ok: true, json: async () => clone(variant.artifact) } : { ok: false, status: 404 };
                if (u.includes('btnyc-interface-contract.json')) return { ok: true, json: async () => clone(CONTRACT) };
                if (u.includes('btnyc_source.json')) throw new Error('the page read the authored source');
                return { ok: false, status: 404 };
            };
            window.HTMLElement.prototype.scrollIntoView = function () {};
            window.console.warn = (...a) => warns.push(a.join(' '));
            window.console.error = (...a) => errors.push(a.join(' '));
            window.addEventListener('error', e => pageErrors.push(e.message));
        },
    });
    for (let i = 0; i < 60 && !(dom.window.DB && dom.window.__resolverStatus && dom.window.__resolverStatus.status !== 'loading') && !(variant.hang && dom.window.DB); i++) await wait(100);
    await wait(150);
    return { dom, w: dom.window, warns, errors, pageErrors };
}

// What the page DID for one tap: the drawing call it made, with the services it named.
function instrument(w) {
    const log = { outcome: null, decided: [] };
    w.prefillSmartQuoteFromService = svc => { log.outcome = 'service:' + svc.id; };
    w.renderServices = (_c, services) => { log.outcome = 'choose:' + services.map(s => s.id).join(','); };
    w.sqOpenBuilderPreseeded = () => { log.outcome = 'builder'; };
    w.stDefaultAction = a => a;
    const original = w.decideComponentSymptomTap;
    w.decideComponentSymptomTap = (...args) => { const v = original(...args); log.decided.push(v.decidedBy); return v; };
    return log;
}

function points(DB) {
    const out = [];
    const actionsOf = g => [null, ...(g.dynamic_service_types || []), ...new Set(DB.services.map(s => s.service_type))];
    for (const gid of Object.keys(DB.routing_archetypes)) {
        const ra = DB.routing_archetypes[gid], group = DB.group.find(x => x.id === gid);
        if (!group) continue;
        const tiles = [];
        for (const c of ra.real_component_ids || []) tiles.push({ evidence: { kind: 'component', id: c }, ids: (ra.component_id_to_service_ids || {})[c] || [] });
        for (const s of ra.real_symptom_ids || []) tiles.push({ evidence: { kind: 'symptom', id: s }, ids: (ra.symptom_id_to_service_ids || {})[s] || [] });
        tiles.push({ evidence: { kind: 'none' }, ids: [] });
        tiles.push({ evidence: undefined, ids: (ra.real_symptom_ids || []).length ? ra.symptom_id_to_service_ids[ra.real_symptom_ids[0]] || [] : [] });   // a tile that carries no evidence (a declared-symptom tile)
        for (const t of tiles) for (const action of new Set([...actionsOf(group), ...(ra.real_action_ids || [])])) out.push({ gid, group, action, ...t });
    }
    return out;
}

function sweep(w) {
    const log = instrument(w), result = [];
    for (const p of points(w.DB)) {
        log.outcome = null; log.decided.length = 0;
        w.resolveComponentSymptomTap(p.ids, p.group, p.group.category_id || 'x', p.action, undefined, p.evidence);
        result.push({ key: p.gid + '|' + JSON.stringify(p.evidence) + '|' + p.action + '|' + p.ids.join('+'), outcome: log.outcome, decidedBy: log.decided[0], hasEvidence: !!p.evidence });
    }
    return result;
}

(async () => {
    const drifted = clone(ART);
    drifted.picker['grp.tech_trouble_computer_repair'].component_services['ent.hard_drive'] = ['svc.internal_hardware_replacement'];   // btnyc.json lists two services for comp.hard_drive
    const notUsable = {
        missing: { artifact: null },
        incompatible: (() => { const a = clone(ART); a.interface_version = '2.0.0'; return { artifact: a }; })(),
        stale: (() => { const a = clone(ART); a.interface_version = '1.0.0'; a.$source.derivation_version = '1.1.0'; for (const g of Object.values(a.picker)) delete g.services; return { artifact: a }; })(),
        malformed: (() => { const a = clone(ART); delete a.picker['grp.tech_trouble_computer_repair'].services['svc.data_backup_or_transfer']; return { artifact: a }; })(),
    };
    const expectReason = { missing: 'missing', incompatible: 'incompatible', stale: 'stale', malformed: 'malformed' };

    section('1. The state the page records');
    const A = await boot({ artifact: ART });
    check('with the published artifact: __resolverStatus is "available", and carries the artifact\'s provenance', A.w.__resolverStatus.status === 'available' && A.w.__resolverStatus.provenance.sha256 === ART.$source.sha256, JSON.stringify(A.w.__resolverStatus));
    check('the page booted: the catalog is loaded, no console.error, no page error', !!A.w.DB && A.w.DB.services.length > 0 && A.errors.length === 0 && A.pageErrors.length === 0, A.errors.concat(A.pageErrors).slice(0, 3).join(' | '));
    check('the resolver installed is the one built from that artifact', A.w.Resolver.current().available === true);
    const baseline = sweep(A.w);
    check('the sweep reaches every kind of drawing the picker has (' + baseline.length + ' points)', baseline.length > 500 && ['service:', 'choose:', 'builder'].every(k => baseline.some(r => r.outcome && r.outcome.startsWith(k))), String(baseline.length));

    const variants = {};
    for (const [name, v] of Object.entries(notUsable)) {
        const B = await boot(v);
        variants[name] = B;
        check(name + ' artifact: __resolverStatus is "unavailable", reason "' + expectReason[name] + '"; the page booted without error', B.w.__resolverStatus.status === 'unavailable' && B.w.__resolverStatus.reason === expectReason[name] && B.errors.length === 0 && B.pageErrors.length === 0 && !!B.w.DB, JSON.stringify(B.w.__resolverStatus) + ' ' + B.errors.concat(B.pageErrors).join(' | '));
        check(name + ' artifact: the refusal is said on the console (loud, not silent)', B.warns.some(m => /artifact/i.test(m)), B.warns.join(' | ').slice(0, 200));
    }

    section('2. The same behaviour with or without the resolver');
    for (const [name, B] of Object.entries(variants)) {
        const got = sweep(B.w);
        const diffs = got.filter((r, i) => r.key !== baseline[i].key || r.outcome !== baseline[i].outcome);
        check(name + ' artifact: all ' + got.length + ' points do what they do with the artifact available (0 differences)', got.length === baseline.length && diffs.length === 0, diffs.slice(0, 3).map(d => d.key + ' -> ' + d.outcome).join('\n      '));
    }

    section('3. Who decided');
    {
        const withEv = baseline.filter(r => r.hasEvidence), noEv = baseline.filter(r => !r.hasEvidence);
        check('usable artifact: the resolver decided every one of the ' + withEv.length + ' points that carry evidence', withEv.every(r => r.decidedBy === 'resolver'), withEv.filter(r => r.decidedBy !== 'resolver').slice(0, 3).map(r => r.key).join(' | '));
        check('... and the page decided every one of the ' + noEv.length + ' that carry none (a declared-symptom tile has no id the picker knows)', noEv.every(r => r.decidedBy === 'page'), noEv.filter(r => r.decidedBy !== 'page').slice(0, 3).map(r => r.key).join(' | '));
        for (const [name, B] of Object.entries(variants)) {
            const got = sweep(B.w);
            check(name + ' artifact: the page decided every point (the resolver was asked and had no answer)', got.every(r => r.decidedBy === 'page'), got.filter(r => r.decidedBy !== 'page').slice(0, 3).map(r => r.key).join(' | '));
        }
    }

    section('4. An artifact that no longer lists what btnyc.json lists');
    {
        const D = await boot({ artifact: drifted });
        check('the drifted artifact is compatible by every version (the resolver is available)', D.w.__resolverStatus.status === 'available');
        const got = sweep(D.w);
        const diffs = got.filter((r, i) => r.outcome !== baseline[i].outcome);
        check('the page does what it does with the true artifact at all ' + got.length + ' points', diffs.length === 0, diffs.slice(0, 3).map(d => d.key).join(' | '));
        const pageDecided = got.filter(r => r.hasEvidence && r.decidedBy === 'page');
        check('exactly the tile that disagrees (comp.hard_drive of the computer-repair group, at every action) was decided by the page; every other tile by the resolver', pageDecided.length > 0 && pageDecided.every(r => /^tech_trouble_computer_repair\|\{"kind":"component","id":"comp\.hard_drive"\}/.test(r.key)) && got.filter(r => r.hasEvidence && r.decidedBy === 'resolver').length === got.filter(r => r.hasEvidence).length - pageDecided.length, pageDecided.slice(0, 2).map(r => r.key).join(' | '));
        check('the drift is said on the console, with both lists', D.warns.some(m => /no longer describes/.test(m) && /internal_hardware_replacement/.test(m) && /data_backup_or_transfer/.test(m)), D.warns.join(' | ').slice(0, 300));
        D.dom.window.close();
    }

    section('5. The artifact is not on the boot\'s critical path');
    {
        const H = await boot({ hang: true });
        check('with an artifact request that never answers, the page still boots: catalog loaded, grid live, no error', !!H.w.DB && H.w.DB.services.length > 0 && !!H.w.document.querySelector('#category-card') && H.errors.length === 0 && H.pageErrors.length === 0);
        check('... the resolver is still "loading", not unavailable and not available', H.w.__resolverStatus.status === 'loading' && H.w.Resolver.current().available === false);
        const got = sweep(H.w);
        check('... and a tap before (or without) the artifact is decided by the page, with the same behaviour as with it', got.every(r => r.decidedBy === 'page') && got.every((r, i) => r.outcome === baseline[i].outcome));
        H.dom.window.close();
    }

    section('6. The source: one reader of the artifact, no second authority');
    {
        const reads = QR_TEXT.match(/btnyc_graph\.json/g) || [];
        check('the page names the published artifact in exactly one place (the boot step that hands it to the resolver)', reads.length === 1, 'occurrences: ' + reads.length);
        check('the page never names the authored source (R-SYSTEM-DEPLOY-CONTRACT)', !/btnyc_source/.test(QR_TEXT));
        const dec = (QR_TEXT.match(/function decideComponentSymptomTap[\s\S]*?\n        }\n/) || [''])[0];
        check('decideComponentSymptomTap asks the installed resolver and takes a resolved answer as it is', /Resolver\.current\(\)\.resolveTap\(/.test(dec) && /answer\.status === 'resolved'\) return \{ decision: answer\.decision, serviceIds: answer\.services\.map/.test(dec), dec.slice(0, 200));
        check('... with no `||` or `??` on the resolver\'s answer (R-INVARIANT-PROVENANCE; class DEFECT-ARBITRATION)', !/answer[\w.]*\s*(\|\||\?\?)/.test(dec) && !/(\|\||\?\?)\s*answer/.test(dec));
        const tap = (QR_TEXT.match(/function resolveComponentSymptomTap[\s\S]*?\n        }\n/) || [''])[0];
        check('resolveComponentSymptomTap draws the decision: it no longer holds the service_type comparison that made it', /decideComponentSymptomTap\(/.test(tap) && !/service_type\s*===/.test(tap));
        check('the evidence reaches the resolver from all three call sites (single tile, tile handler, "Something else")', /kind: isComponentFirst \? 'component' : 'symptom', id: ids\[0\]/.test(QR_TEXT) && /id: entry\.id/.test(QR_TEXT) && /\{ kind: 'none' \}/.test(QR_TEXT));
        check('counterfactual: a page that kept the comparison in the executor would be seen by the same scan', /service_type\s*===/.test('if (s.service_type === chosenAction) {}'));
    }

    for (const B of [A, ...Object.values(variants)]) B.dom.window.close();
    console.log(`\n[Resolver wiring: same behaviour, different decider] ${pass} passed, ${fail} failed (of ${pass + fail} checks)`);
    process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
