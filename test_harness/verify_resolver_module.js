#!/usr/bin/env node
/**
 * verify_resolver_module.js -- modules/resolver.js (T179): what it reads, how it fails, what it owns, and that its answer is the answer the page gave before it existed.
 *
 * @enforces R-SYSTEM-DEPLOY-CONTRACT
 * @enforces R-INVARIANT-PROVENANCE
 *
 * The resolver is the first module to read the published artifact (ssot/derived/btnyc_graph.json). This file is independent of the derivation: nothing here calls derive_graph.js to make an
 * expected value. The expected value of the equivalence sweep is the legacy decision itself -- the body of qr.html's resolveComponentSymptomTap, frozen below as it was before T179 -- run over
 * the catalog the page serves today (btnyc.json). Where the resolver is meant to differ from the legacy page, the difference is named and pinned (section 6), not tolerated.
 *
 *   1. THE BOUNDARY    The resolver reads the artifact only through ArtifactCompat.check against the consumer contract, and the artifact it takes is the published one: provenance is the artifact's own.
 *   2. FAILING SAFE    Missing, stale, incompatible and malformed artifacts each make an UNAVAILABLE resolver (a distinct reason, no exception); it answers every query 'unavailable'; nothing is guessed.
 *   3. STALE DATA      An available resolver that is told what the runtime's data lists, and disagrees, refuses to answer ('stale'). A version number is not the only way an artifact goes out of date.
 *   4. OWNERSHIP       The file computes no price, no confidence, no route, no question order; touches no DOM, no btnyc.json, no authored source, no network. A mutant that does is seen.
 *   5. EQUIVALENCE     For every group the picker serves, every tile a customer can tap, and every action the group offers (and none): the resolver's decision and services are the legacy decision's.
 *   6. DIFFERENCES     The artifact knows tiles the legacy page never draws; they are pinned so a change to them is seen.
 *   7. PROVENANCE      Every resolved answer carries `source`; a caller is given no field it would have to default.
 *   8. THE ID BOUNDARY The three id rules agree with the legacy mirror's own projection, for every group, component, symptom and service the picker names.
 */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = process.env.QR_ROOT || path.resolve(__dirname, '..');
const Resolver = require(path.join(ROOT, 'modules', 'resolver.js'));
const Compat = require(path.join(ROOT, 'modules', 'artifact_compat.js'));

let pass = 0, fail = 0;
const check = (name, ok, detail) => { if (ok) { pass++; console.log('  ✓ ' + name); } else { fail++; console.log('  ✗ ' + name + (detail ? '\n      ' + detail : '')); } };
const section = t => console.log('\n=== ' + t + ' ===');
const clone = o => JSON.parse(JSON.stringify(o));
const ART = JSON.parse(fs.readFileSync(path.join(ROOT, 'ssot', 'derived', 'btnyc_graph.json'), 'utf8'));
const CONTRACT = JSON.parse(fs.readFileSync(path.join(ROOT, 'schema', 'btnyc-interface-contract.json'), 'utf8'));
const DB = JSON.parse(fs.readFileSync(path.join(ROOT, 'btnyc.json'), 'utf8'));
const SRC = fs.readFileSync(path.join(ROOT, 'modules', 'resolver.js'), 'utf8');

// ── the legacy decision, frozen: the body of resolveComponentSymptomTap (qr.html, T178 tree) with the three drawing calls replaced by the decision they made ──────────────────────────────
function legacyTapDecision(services, serviceIds, chosenAction) {
    const find = id => services.find(s => s.id === id);
    if (serviceIds.length > 1 && chosenAction) {
        const typedMatches = serviceIds.map(find).filter(s => s && s.service_type === chosenAction);
        if (typedMatches.length === 1) return { decision: 'service', ids: [typedMatches[0].id] };
    }
    if (serviceIds.length === 1) { const svc = find(serviceIds[0]); if (svc) return { decision: 'service', ids: [svc.id] }; }
    if (serviceIds.length > 1) { const matched = serviceIds.map(find).filter(Boolean); if (matched.length) return { decision: 'choose', ids: matched.map(s => s.id) }; }
    return { decision: 'unresolved', ids: [] };
}

// ── 1. the boundary ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
section('1. The boundary: the published artifact, through the compatibility check');
const R = Resolver.create(ART, CONTRACT);
check('the published artifact is accepted by the consumer contract (ArtifactCompat.check)', Compat.check(ART, CONTRACT).ok === true);
check('the resolver built from it is available', R.available === true && R.reason === null, JSON.stringify(R.detail));
check('its provenance is the artifact\'s own $source and interface (not a value of its own)', R.provenance.sha256 === ART.$source.sha256 && R.provenance.derivation_version === ART.$source.derivation_version && R.provenance.source_schema_version === ART.$source.source_schema_version && R.provenance.interface_version === ART.interface_version);
check('the resolver asks the check before it reads an index: a check that refuses makes it unavailable even though the picker is intact', (() => {
    const a = clone(ART); a.$source.source_schema_version = '9.9.9';
    const r = Resolver.create(a, CONTRACT);
    return r.available === false && r.reason === 'incompatible' && /source schema/.test(r.detail);
})());
check('the contract the page will use needs interface 1.1.0 (picker.services), and the artifact says 1.1.0', CONTRACT.interface_version === '1.1.0' && ART.interface_version === '1.1.0');
check('the manifest names this module as the picker\'s consumer', ART.manifest.indexes.picker.consumers.some(c => c.module === 'resolver.js'));

// ── 2. failing safe ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
section('2. Failing safe: no usable artifact is an unavailable resolver, never an exception, never a guess');
const QUERY = { group_id: 'tech_trouble_computer_repair', action: 'Repair', evidence: { kind: 'component', id: 'comp.hard_drive' } };
function expectUnavailable(label, artifact, contract, reason) {
    let r, threw = null;
    try { r = Resolver.create(artifact, contract); } catch (e) { threw = e; }
    check(label + ': create does not throw', !threw, threw && threw.message);
    if (threw) return;
    check(label + ': unavailable, reason "' + reason + '"', r.available === false && r.reason === reason, 'available=' + r.available + ' reason=' + r.reason + ' ' + (r.detail || ''));
    const ans = r.resolveTap(QUERY);
    check(label + ': every query answers status "unavailable" with the reason, and nothing else to default', ans.status === 'unavailable' && ans.reason === reason && !('decision' in ans) && !('services' in ans), JSON.stringify(ans));
}
expectUnavailable('undefined artifact', undefined, CONTRACT, 'missing');
expectUnavailable('null artifact', null, CONTRACT, 'missing');
expectUnavailable('a string where the artifact should be', '{"picker":{}}', CONTRACT, 'missing');
expectUnavailable('an array where the artifact should be', [], CONTRACT, 'missing');
{ const a = clone(ART); a.interface_version = '2.0.0'; expectUnavailable('a different MAJOR interface', a, CONTRACT, 'incompatible'); }
{ const a = clone(ART); a.interface_version = '1.0.0'; expectUnavailable('an OLDER minor interface (1.0.0: no picker.services)', a, CONTRACT, 'stale'); }
{ const a = clone(ART); a.$source.derivation_version = '1.1.0'; a.interface_version = '1.0.0'; expectUnavailable('the T177 artifact (derivation 1.1.0, interface 1.0.0)', a, CONTRACT, 'stale'); }
{ const a = clone(ART); a.$source.derivation_version = '1.1.0'; expectUnavailable('an older derivation with a current interface', a, CONTRACT, 'stale'); }
{ const a = clone(ART); a.$source.derivation_version = '3.0.0'; expectUnavailable('a derivation newer than any the consumer accepts', a, CONTRACT, 'incompatible'); }
{ const a = clone(ART); a.$source.source_schema_version = '2.0.0'; expectUnavailable('an unaccepted source schema', a, CONTRACT, 'incompatible'); }
{ const a = clone(ART); delete a.$source; expectUnavailable('no $source (not a published artifact)', a, CONTRACT, 'incompatible'); }
{ const a = clone(ART); delete a.recovery; expectUnavailable('a required index absent', a, CONTRACT, 'incompatible'); }
{ const a = clone(ART); a.interface_version = 'one'; expectUnavailable('an interface version that is not a version', a, CONTRACT, 'incompatible'); }
expectUnavailable('no contract to check against', ART, undefined, 'incompatible');
expectUnavailable('a contract with no accepts clause', ART, { interface_version: '1.1.0' }, 'incompatible');
{ const a = clone(ART); delete a.picker['grp.tech_trouble_computer_repair'].services; expectUnavailable('picker.services absent in one group (passes the check, lacks what the resolver reads)', a, CONTRACT, 'malformed'); }
{ const a = clone(ART); delete a.picker['grp.tech_trouble_computer_repair'].services['svc.internal_hardware_replacement']; expectUnavailable('a service the picker reaches that picker.services does not describe', a, CONTRACT, 'malformed'); }
{ const a = clone(ART); a.picker = []; expectUnavailable('picker is not an object', a, CONTRACT, 'malformed'); }
{ const a = clone(ART); a.picker['grp.tech_trouble_computer_repair'].services['svc.data_backup_or_transfer'].action_label = 7; expectUnavailable('a service whose action label is not a string', a, CONTRACT, 'malformed'); }
check('a resolver that was never given an artifact (Resolver.current() before install) is unavailable \'missing\', not null', (() => { const c = Resolver.current(); return !!c && c.available === false && c.reason === 'missing' && c.resolveTap(QUERY).status === 'unavailable'; })());
check('install() puts an instance in place and current() returns it; installing nothing puts the unavailable one back', (() => {
    Resolver.install(R); const on = Resolver.current() === R && Resolver.current().resolveTap(QUERY).status === 'resolved';
    Resolver.install(null); const off = Resolver.current().available === false;
    return on && off;
})());
check('malformed queries on an available resolver answer \'unknown\', not an exception', (() => {
    const bad = [undefined, null, {}, { group_id: 3 }, { group_id: 'x' }, { group_id: 'x', evidence: 'comp.x' }, { group_id: 'tech_trouble_computer_repair', evidence: { kind: 'component', id: 'ent.hard_drive' } }, { group_id: 'tech_trouble_computer_repair', evidence: { kind: 'wat' } }];
    return bad.every(q => { try { const a = R.resolveTap(q); return a.status === 'unknown'; } catch (e) { return false; } });
})());
check('an unknown group, and a tile the artifact does not know, are \'unknown\' with a reason (the caller does what it did before)', (() => {
    const a = R.resolveTap({ group_id: 'no_such_group', action: null, evidence: { kind: 'none' } }), b = R.resolveTap({ group_id: 'tech_trouble_computer_repair', action: null, evidence: { kind: 'component', id: 'comp.no_such_part' } });
    return a.status === 'unknown' && a.reason === 'unknown_group' && b.status === 'unknown' && b.reason === 'unknown_evidence';
})());

// ── 3. stale against the data the runtime serves ────────────────────────────────────────────────────────────────────────────────
section('3. Stale against the runtime\'s own data');
{
    const legacyIds = DB.routing_archetypes.tech_trouble_computer_repair.component_id_to_service_ids['comp.hard_drive'];
    const ok = R.resolveTap(Object.assign({}, QUERY, { expect_services: legacyIds }));
    check('told the services the runtime lists, and they are the artifact\'s: it answers', ok.status === 'resolved', JSON.stringify(ok));
    const drift = R.resolveTap(Object.assign({}, QUERY, { expect_services: ['internal_hardware_replacement'] }));
    check('told a different list (the runtime\'s data moved, the artifact did not): status \'stale\' (runtime_data_differs), no decision', drift.status === 'stale' && drift.reason === 'runtime_data_differs' && !('decision' in drift), JSON.stringify(drift));
    check('... the answer says what each side held, so the log is enough to find the drift', JSON.stringify(drift.expected) === '["internal_hardware_replacement"]' && JSON.stringify(drift.found) === JSON.stringify(legacyIds));
    const reordered = R.resolveTap(Object.assign({}, QUERY, { expect_services: legacyIds.slice().reverse() }));
    check('the same services in another order are stale too (the order is what the customer sees)', reordered.status === 'stale');
    const none = R.resolveTap({ group_id: 'tech_trouble_computer_repair', action: null, evidence: { kind: 'none' }, expect_services: ['internal_hardware_replacement'] });
    check('"Something else" lists no service; a runtime that lists one disagrees', none.status === 'stale');
    check('with no expectation given, nothing is compared (the caller made no claim)', R.resolveTap(QUERY).status === 'resolved');
}

// ── 4. ownership ───────────────────────────────────────────────────────────────────────────────────────────────────────────────
section('4. Ownership: a resolution, and only a resolution');
// Comments are the file's own explanation of what it does not do, so the scan reads code with comments and string literals blanked.
const stripComments = s => s.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' ')).replace(/(^|[^:])\/\/[^\n]*/g, (m, a) => a + ' '.repeat(m.length - a.length));
const FORBIDDEN = [
    ['price / money', /\b(price|pricing|financial_engine|base_price|labor|\$\s*\d|total|fee|surcharge|discount|quote)\w*/i],
    ['confidence arithmetic', /\bconfidence|\bscore\b|\bthreshold\b|Math\.(min|max|round)/i],
    ['route policy', /route|\bbranch|\bnext_question|\bworkflow|\bexecuteWorkflow/i],
    ['question-chain composition', /\bintake_chain|\bchains?\b|\bcompose|\bquestions\b/i],
    ['UI behaviour', /\bdocument\b|\bwindow\b|\binnerHTML\b|\baddEventListener|\bquerySelector|\bgetElementById/],
    ['the legacy catalog', /\bbtnyc\.json\b|\bSERVICE_DATA\b|\bDB\b|\brouting_archetypes\b/],
    ['the authored source', /btnyc_source|ssot\/btnyc|\breadFileSync|\brequire\(\s*['"]fs['"]/],
    ['the network', /\bfetch\(|XMLHttpRequest|\brequire\(\s*['"](https?|net)['"]/],
];
const code = stripComments(SRC).replace(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"/g, "''");
for (const [what, re] of FORBIDDEN) check('resolver.js contains no ' + what, !re.test(code), (code.match(re) || [''])[0]);
check('the only artifact index it names is `picker`', (() => { const idx = ['entities', 'questions', 'option_bridge', 'chains', 'confidence', 'retirement_index', 'recovery', 'composition_index', 'alias_index', 'action_vocabulary', 'formula_inputs', 'price_influence', 'used_by']; return !idx.some(i => new RegExp('\\.' + i + '\\b|\\[\'' + i + '\'\\]').test(code)); })());
// non-vacuity: each forbidden class is seen when it is present
const mutants = [
    ['a price', 'var p = artifact.price_influence;'], ['a confidence score', 'var s = Math.round(x * 100);'], ['a route', 'var next = resolveRoute(x);'], ['a question chain', 'var c = artifact.chains[x];'],
    ['the DOM', 'document.getElementById("x");'], ['the legacy catalog', 'var s = DB.services;'], ['the authored source', 'var s = require("fs").readFileSync("ssot/btnyc_source.json");'], ['the network', 'fetch("btnyc.json");'],
];
for (const [what, line] of mutants) {
    const c = stripComments(SRC + '\n' + line).replace(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"/g, "''");
    check('counterfactual: a resolver that touches ' + what + ' is seen by the scan', FORBIDDEN.some(([, re]) => re.test(c)) || /\.(chains|price_influence)\b/.test(c));
}

// ── 5. equivalence with the legacy decision ─────────────────────────────────────────────────────────────────────────────────────
section('5. Equivalence: the resolver\'s decision is the decision the page made');
const actionsOf = g => [null, ...(g.dynamic_service_types || []), ...new Set(DB.services.map(s => s.service_type))];
let points = 0, diffs = [], unknowns = [], byDecision = { service: 0, choose: 0, unresolved: 0 }, groupsSwept = 0;
for (const gid of Object.keys(DB.routing_archetypes)) {
    const ra = DB.routing_archetypes[gid], grp = DB.group.find(x => x.id === gid) || {};
    groupsSwept++;
    const tiles = [];
    for (const c of ra.real_component_ids || []) tiles.push({ evidence: { kind: 'component', id: c }, ids: (ra.component_id_to_service_ids || {})[c] || [] });
    for (const s of ra.real_symptom_ids || []) tiles.push({ evidence: { kind: 'symptom', id: s }, ids: (ra.symptom_id_to_service_ids || {})[s] || [] });
    tiles.push({ evidence: { kind: 'none' }, ids: [] });
    for (const t of tiles) for (const action of new Set([...actionsOf(grp), ...(ra.real_action_ids || [])])) {
        points++;
        const want = legacyTapDecision(DB.services, t.ids, action);
        const got = R.resolveTap({ group_id: gid, action, evidence: t.evidence, expect_services: t.ids });
        if (got.status !== 'resolved') { unknowns.push(gid + ' ' + JSON.stringify(t.evidence) + ' ' + action + ' -> ' + got.status + (got.reason ? '/' + got.reason : '')); continue; }
        byDecision[got.decision]++;
        const gotIds = got.services.map(s => s.runtime_id);
        if (got.decision !== want.decision || JSON.stringify(gotIds) !== JSON.stringify(want.ids)) diffs.push(gid + ' ' + JSON.stringify(t.evidence) + ' action=' + action + ' legacy=' + want.decision + JSON.stringify(want.ids) + ' resolver=' + got.decision + JSON.stringify(gotIds));
    }
}
check('the sweep covers all ' + Object.keys(DB.routing_archetypes).length + ' groups and ' + points + ' (group, tile, action) points, with a decision of every kind', groupsSwept === Object.keys(DB.routing_archetypes).length && points > 500 && byDecision.service > 0 && byDecision.choose > 0 && byDecision.unresolved > 0, JSON.stringify(byDecision) + ' points=' + points);
check('every tile the legacy page draws is one the artifact knows, and its services are the ones the page lists (0 stale, 0 unknown)', unknowns.length === 0, unknowns.slice(0, 5).join('\n      '));
check('the decision and the services (in order) equal the legacy decision at every point (0 differences)', diffs.length === 0, diffs.slice(0, 5).join('\n      ') + (diffs.length > 5 ? '\n      ... ' + diffs.length + ' in all' : ''));
check('counterfactual: the sweep sees a resolver whose artifact swaps two services of a component', (() => {
    const a = clone(ART); const e = a.picker['grp.tech_trouble_computer_repair'];
    e.component_services['ent.hard_drive'] = e.component_services['ent.hard_drive'].slice().reverse();
    const r = Resolver.create(a, CONTRACT); const ra = DB.routing_archetypes.tech_trouble_computer_repair;
    const got = r.resolveTap({ group_id: 'tech_trouble_computer_repair', action: null, evidence: { kind: 'component', id: 'comp.hard_drive' }, expect_services: ra.component_id_to_service_ids['comp.hard_drive'] });
    return got.status === 'stale';
})());
check('counterfactual: ... and one whose artifact mislabels a service\'s action changes the decision the sweep compares', (() => {
    const a = clone(ART); const e = a.picker['grp.tech_trouble_computer_repair'];
    e.services['svc.data_backup_or_transfer'].action_label = 'Repair';          // both services of comp.hard_drive now say Repair: the action no longer picks one
    const r = Resolver.create(a, CONTRACT);
    const got = r.resolveTap({ group_id: 'tech_trouble_computer_repair', action: 'Repair', evidence: { kind: 'component', id: 'comp.hard_drive' } });
    const want = legacyTapDecision(DB.services, DB.routing_archetypes.tech_trouble_computer_repair.component_id_to_service_ids['comp.hard_drive'], 'Repair');
    return want.decision === 'service' && got.decision === 'choose';
})());
check('a real case reads as the page\'s comment says: comp.hard_drive + Repair -> internal_hardware_replacement; + Setup -> data_backup_or_transfer; no action -> a choice of both', (() => {
    const q = a => R.resolveTap({ group_id: 'tech_trouble_computer_repair', action: a, evidence: { kind: 'component', id: 'comp.hard_drive' } });
    return q('Repair').services.map(s => s.runtime_id).join() === 'internal_hardware_replacement' && q('Setup').services.map(s => s.runtime_id).join() === 'data_backup_or_transfer' && q(null).decision === 'choose' && q(null).services.length === 2;
})());
check('a real case: comp.tv has two Install services; the action cannot choose between them, so the customer does (the comment on resolveComponentSymptomTap)', (() => {
    const g = Object.keys(DB.routing_archetypes).find(k => (DB.routing_archetypes[k].component_id_to_service_ids || {})['comp.tv']);
    if (!g) return false;
    const a = R.resolveTap({ group_id: g, action: 'Install', evidence: { kind: 'component', id: 'comp.tv' } });
    return a.status === 'resolved' && a.decision === 'choose' && a.services.length >= 2;
})());
check('a real case: "Something else" resolves to no service, from the fallback', (() => { const a = R.resolveTap({ group_id: 'tech_trouble_computer_repair', action: 'Repair', evidence: { kind: 'none' } }); return a.decision === 'unresolved' && a.services.length === 0 && a.source === 'fallback'; })());

// ── 6. intended differences ─────────────────────────────────────────────────────────────────────────────────────────────────────
section('6. Intended differences from the legacy page (named, pinned)');
{
    const extra = [];
    for (const gid of Object.keys(DB.routing_archetypes)) {
        const known = new Set(DB.routing_archetypes[gid].real_symptom_ids || []);
        for (const sid of Object.keys(ART.picker['grp.' + gid].symptoms)) if (!known.has(sid)) extra.push(gid.replace('minor_home_repairs_appliances', 'appl') + ':' + sid);
    }
    check('the artifact\'s picker knows symptoms the legacy page never draws as an id-keyed tile (they come from the group\'s symptom question; the page draws that group\'s own module options)', extra.length > 0, 'none found');
    check('there are exactly 22 of them (a change to the count is a change to the question lists or the legacy ids, and is looked at: PENDING_DECISIONS #226)', extra.length === 22, String(extra.length));
    const groupsWithExtra = [...new Set(extra.map(x => x.split(':')[0]))].sort();
    check('they are confined to the six groups whose symptom is a declared question, not an authored tile list: ' + groupsWithExtra.join(', '), groupsWithExtra.length === 6 && groupsWithExtra.every(g => /^appl/.test(g)), JSON.stringify(groupsWithExtra));
    check('the page does not route a declared-symptom tile through the resolver (it carries no evidence, so the page keeps its own list for it); see verify_resolver_wiring.js', true);
    check('an extra symptom in a group the page draws no id-keyed tile for answers from the artifact if asked (the resolver is a function of the artifact, not of the page)', (() => { const a = R.resolveTap({ group_id: 'minor_home_repairs_appliances_microwave', action: null, evidence: { kind: 'symptom', id: 'sym.other_describe_in_notes' } }); return a.status === 'resolved' && a.services.map(s => s.runtime_id).join() === 'microwave_repair'; })());
}

// ── 7. provenance ───────────────────────────────────────────────────────────────────────────────────────────────────────────────
section('7. Provenance on every answer');
{
    const SOURCES = ['service_override', 'archetype_default', 'dynamic_engine', 'fallback', 'answer_override'];
    let n = 0, bad = [];
    for (const [gid] of Object.entries(DB.routing_archetypes)) for (const c of Object.keys(ART.picker['grp.' + gid].component_services)) {
        const a = R.resolveTap({ group_id: gid, action: null, evidence: { kind: 'component', id: 'comp.' + c.slice(4) } }); n++;
        if (!(a.status === 'resolved' && SOURCES.includes(a.source) && typeof a.because === 'string' && a.decision && Array.isArray(a.services) && a.evidence && a.evidence.group_id === gid)) bad.push(gid + ' ' + c);
    }
    check('all ' + n + ' component answers carry decision, services, source (one of the Charter\'s five), because, and the evidence they answered', n > 0 && bad.length === 0, bad.slice(0, 3).join(', '));
    check('a service the picker names carries the id the artifact holds, the id the page holds, and the action it is', (() => { const s = R.resolveTap({ group_id: 'tech_trouble_computer_repair', action: 'Repair', evidence: { kind: 'component', id: 'comp.hard_drive' } }).services[0]; return s.id === 'svc.internal_hardware_replacement' && s.runtime_id === 'internal_hardware_replacement' && s.action_id === 'act.repair' && s.action_label === 'Repair'; })());
    check('an answer from a mapped tile is \'archetype_default\'; one from no mapping is \'fallback\'', R.resolveTap(QUERY).source === 'archetype_default' && R.resolveTap({ group_id: 'tech_trouble_computer_repair', action: null, evidence: { kind: 'none' } }).source === 'fallback');
}

// ── 8. the id boundary ────────────────────────────────────────────────────────────────────────────────────────────────────────────
section('8. The id boundary agrees with the legacy mirror\'s projection');
{
    const gids = Object.keys(DB.routing_archetypes);
    check('every legacy group id maps to a picker group, and every picker group is a legacy group (39 = 39)', gids.every(g => ART.picker[Resolver.toArtifactGroup(g)]) && Object.keys(ART.picker).length === gids.length && Object.keys(ART.picker).every(k => gids.includes(k.replace(/^grp\./, ''))));
    let comps = 0, badComps = [], svcs = 0, badSvcs = [];
    for (const g of gids) {
        const ra = DB.routing_archetypes[g], e = ART.picker[Resolver.toArtifactGroup(g)];
        for (const c of ra.real_component_ids || []) { comps++; if (!e.component_entity_ids.includes(Resolver.toArtifactComponent(c))) badComps.push(g + ' ' + c); }
        for (const s of Object.values(ra.component_id_to_service_ids || {}).flat()) { svcs++; if (!(('svc.' + s) in e.services) || Resolver.toRuntimeService('svc.' + s) !== s) badSvcs.push(g + ' ' + s); }
    }
    check('all ' + comps + ' legacy component ids map to the entity the picker lists for that group', comps > 0 && badComps.length === 0, badComps.slice(0, 3).join(', '));
    check('all ' + svcs + ' service ids the legacy page lists map to a service the picker describes, and back', svcs > 0 && badSvcs.length === 0, badSvcs.slice(0, 3).join(', '));
    check('a service id with no prefix is left alone (the rule strips "svc." and nothing else)', Resolver.toRuntimeService('computer_diagnostic') === 'computer_diagnostic' && Resolver.toRuntimeService('svc.a.b') === 'a.b');
    const projected = require(path.join(ROOT, 'test_harness', 'tools', 'entity_first', 'project_legacy.js'));
    check('(the legacy mirror is the projection the boundary inverts: project_legacy.js is on disk and exports a projection)', projected && typeof projected === 'object');
}

console.log(`\n[Resolver module: boundary, failing safe, ownership, equivalence] ${pass} passed, ${fail} failed (of ${pass + fail} checks)`);
process.exit(fail ? 1 : 0);
