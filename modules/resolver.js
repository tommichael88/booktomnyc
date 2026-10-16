/**
 * resolver.js (T179) -- the first module extracted from the Layer Map's target list, and the first reader of the published artifact.
 *
 * LAYER: Logic / Engine (COMPONENT_LAYER_MAP.md, `resolver.js`). Owns: resolving a customer's evidence against the domain graph into the canonical interpretation, with provenance.
 * Must not absorb: confidence arithmetic, question-chain composition, route policy, pricing policy, UI behavior. Nothing in this file adds a price, scores a confidence, orders a question or
 * draws anything; it returns WHICH service(s) a tap on a component or a symptom means, and says where that answer came from.
 *
 * WHAT IT RESOLVES TODAY (one concern, whole): a tap in the component / symptom picker -> one service, a short list the customer chooses from, or no service. That decision used to live inside
 * qr.html's resolveComponentSymptomTap, mixed with the drawing of the answer. The page now asks this module and DRAWS what it is told; the legacy decision stays in the page as the fail-safe
 * (below) until the legacy data shape retires (PENDING_DECISIONS #212).
 *
 * WHERE ITS KNOWLEDGE COMES FROM: only the published artifact (ssot/derived/btnyc_graph.json, its `picker` index; the manifest names this module as the picker's consumer), through the
 * compatibility boundary: create() runs ArtifactCompat.check (modules/artifact_compat.js, the check the publisher ran) against the consumer contract (schema/btnyc-interface-contract.json)
 * BEFORE it reads an index, and then checks the shape of exactly what it reads. It never reads the authored source (R-SYSTEM-DEPLOY-CONTRACT), btnyc.json, or the DOM.
 *
 * FAILING SAFE (the four ways an artifact is not usable, each a distinct reason, none an exception):
 *   missing       nothing was given, or what was given is not an object                 -> reason 'missing'
 *   stale         older than this module needs (interface minor, or derivation, behind)  -> reason 'stale'
 *   incompatible  a different major interface, an unaccepted source schema / derivation,
 *                 no provenance, a required index absent                                 -> reason 'incompatible'
 *   malformed     passes the check but lacks what this module reads (picker.services)    -> reason 'malformed'
 * An unavailable resolver answers EVERY query with status 'unavailable'; the caller keeps doing what it did before the resolver existed. And a resolver that IS available still refuses to answer
 * when the runtime tells it what it expects and that disagrees with the artifact (status 'stale', reason 'runtime_data_differs'): an artifact that no longer describes the data the page serves
 * is stale for that question, whatever its version says.
 *
 * PROVENANCE (R-INVARIANT-PROVENANCE): every answer carries `source`: 'archetype_default' when the group's routing archetype (the picker) names the service(s), 'fallback' when it names none.
 * A caller reads `decision`, `services` and `source` as they are; it does not default them, merge them with another source, or recompute them (R-INVARIANT-PROVENANCE).
 *
 * THE ID BOUNDARY (a transition adapter, removed with the legacy data shape, #212): the page still holds the ids btnyc.json holds ("tech_trouble_computer_repair", "comp.hard_drive",
 * "computer_diagnostic"); the artifact holds the entity-first ids ("grp.tech_trouble_computer_repair", "ent.hard_drive", "svc.computer_diagnostic"). The three rules below are the same ones
 * test_harness/tools/entity_first/project_legacy.js applies in the other direction, and test_harness/verify_resolver_module.js proves them against its output for every group.
 *
 * Deployment: loaded from modules/resolver.js by qr.html, with a `src` script tag; in Node it is require()d. The page creates the instance at boot and installs it (install / current).
 *
 * Load artifact_compat.js before this file.
 */
(function (root, factory) {
    var compat = (typeof module === 'object' && module.exports) ? require('./artifact_compat.js') : root.ArtifactCompat;
    if (typeof module === 'object' && module.exports) module.exports = factory(compat);
    else root.Resolver = factory(compat);
})(typeof self !== 'undefined' ? self : this, function (ArtifactCompat) {
    'use strict';

    // ---- the id boundary ------------------------------------------------------------------------------------------------------------------------------------------------------------
    var toArtifactGroup = function (g) { return 'grp.' + g; };
    var toArtifactComponent = function (c) { return 'ent.' + c.slice('comp.'.length); };
    var toRuntimeService = function (s) { return s.indexOf('svc.') === 0 ? s.slice('svc.'.length) : s; };

    var isObj = function (v) { return v !== null && typeof v === 'object' && !Array.isArray(v); };
    var has = function (o, k) { return Object.prototype.hasOwnProperty.call(o, k); };

    // ---- the four ways an artifact is not usable ------------------------------------------------------------------------------------------------------------------------------------
    // Which of check()'s problems means "older than this consumer needs" (stale) and which means "not what this consumer accepts" (incompatible). A version is read as major.minor.patch.
    function classify(artifact, contract, problems) {
        var parse = ArtifactCompat.parse;
        var have = parse(artifact.interface_version), want = parse(contract.interface_version);
        var accepted = (contract.accepts.derivation_versions || []).map(parse).filter(Boolean);
        var derived = artifact.$source && parse(artifact.$source.derivation_version);
        var older = function (a, b) { return a[0] !== b[0] ? a[0] < b[0] : a[1] !== b[1] ? a[1] < b[1] : a[2] < b[2]; };
        var onlyOlder = problems.length > 0 && problems.every(function (p) {
            if (p.kind === 'interface_version') return !!(have && want && have[0] === want[0] && have[1] < want[1]);
            if (p.kind === 'derivation_version') return !!(derived && accepted.length && accepted.every(function (a) { return older(derived, a); }));
            return false;
        });
        return onlyOlder ? 'stale' : 'incompatible';
    }

    // The shape of exactly what this module reads from the picker index. Returns null, or the first thing wrong, in words.
    function pickerShapeProblem(artifact) {
        var picker = artifact.picker;
        if (!isObj(picker)) return 'picker is not an object';
        var groups = Object.keys(picker);
        for (var i = 0; i < groups.length; i++) {
            var g = groups[i], e = picker[g];
            if (!isObj(e) || typeof e.entry_mode !== 'string' || !Array.isArray(e.component_entity_ids) || !isObj(e.component_services) || !isObj(e.symptoms) || !isObj(e.services)) return 'picker[' + g + '] lacks entry_mode, component_entity_ids, component_services, symptoms or services';
            var referenced = [];
            Object.keys(e.component_services).forEach(function (c) { if (!Array.isArray(e.component_services[c])) referenced.push(null); else referenced.push.apply(referenced, e.component_services[c]); });
            Object.keys(e.symptoms).forEach(function (s) { var ids = e.symptoms[s] && e.symptoms[s].service_ids; if (!Array.isArray(ids)) referenced.push(null); else referenced.push.apply(referenced, ids); });
            for (var j = 0; j < referenced.length; j++) {
                var id = referenced[j];
                if (typeof id !== 'string' || !has(e.services, id) || !isObj(e.services[id]) || typeof e.services[id].action_label !== 'string' || typeof e.services[id].action_id !== 'string') return 'picker[' + g + '] reaches a service (' + String(id) + ') that picker[' + g + '].services does not describe';
            }
        }
        return null;
    }

    // ---- the instance ---------------------------------------------------------------------------------------------------------------------------------------------------------------
    function unavailable(reason, detail) {
        var answer = function () { return { status: 'unavailable', reason: reason }; };
        return { available: false, reason: reason, detail: detail, resolveTap: answer };
    }

    /**
     * create(artifact, contract) -> a resolver. Never throws. `available` says whether the artifact may be read; `reason` and `detail` say why not.
     */
    function create(artifact, contract) {
        if (!isObj(artifact)) return unavailable('missing', 'no artifact was given');
        if (!isObj(contract) || !isObj(contract.accepts)) return unavailable('incompatible', 'no consumer contract was given, so nothing can be checked');
        var verdict;
        try { verdict = ArtifactCompat.check(artifact, contract); } catch (e) { return unavailable('incompatible', 'the compatibility check could not run: ' + (e && e.message)); }
        if (!verdict.ok) return unavailable(classify(artifact, contract, verdict.problems), ArtifactCompat.refusal(verdict));
        var shape = pickerShapeProblem(artifact);
        if (shape) return unavailable('malformed', shape);
        var picker = artifact.picker;
        var provenance = { sha256: artifact.$source.sha256, source_schema_version: artifact.$source.source_schema_version, derivation_version: artifact.$source.derivation_version, interface_version: artifact.interface_version };

        // A service the way a caller needs it: the artifact's id, the id the page holds, and what it is.
        function describe(entry, id) { return { id: id, runtime_id: toRuntimeService(id), action_id: entry.services[id].action_id, action_label: entry.services[id].action_label }; }

        /**
         * resolveTap({ group_id, action, evidence, expect_services }) -- what a tap in the component / symptom picker means.
         *   group_id         the group the picker is open on                                                        (the id the page holds: "tech_trouble_computer_repair")
         *   action           the action the customer chose in that group, as the group offers it ("Repair"), or null
         *   evidence         { kind: 'component', id: 'comp.hard_drive' } | { kind: 'symptom', id: 'sym.slow_laggy' } | { kind: 'none' } ("Something else")
         *   expect_services  optional: the services the runtime's own data lists for this tap (the page's ids). When given and different, the artifact is stale for this tap and no answer is given.
         * Returns { status: 'resolved', decision: 'service' | 'choose' | 'unresolved', services: [...], source, because, evidence, action }
         *      or { status: 'unknown', reason }       the artifact does not know this group or this evidence: the caller does what it did before
         *      or { status: 'stale', reason, expected, found }
         */
        function resolveTap(request) {
            var req = isObj(request) ? request : {};
            var action = typeof req.action === 'string' && req.action ? req.action : null;
            var ev = isObj(req.evidence) ? req.evidence : null;
            if (typeof req.group_id !== 'string' || !ev) return { status: 'unknown', reason: 'bad_request' };
            var entry = has(picker, toArtifactGroup(req.group_id)) ? picker[toArtifactGroup(req.group_id)] : null;
            if (!entry) return { status: 'unknown', reason: 'unknown_group' };

            var ids;
            if (ev.kind === 'none') ids = [];
            else if (ev.kind === 'component' && typeof ev.id === 'string' && ev.id.indexOf('comp.') === 0) {
                var ent = toArtifactComponent(ev.id);
                // a component the group lists but links to no service is known, and maps to nothing (the picker's own zero-service case)
                if (!has(entry.component_services, ent) && entry.component_entity_ids.indexOf(ent) < 0) return { status: 'unknown', reason: 'unknown_evidence' };
                ids = has(entry.component_services, ent) ? entry.component_services[ent] : [];
            } else if (ev.kind === 'symptom' && typeof ev.id === 'string' && ev.id.indexOf('sym.') === 0) {
                if (!has(entry.symptoms, ev.id)) return { status: 'unknown', reason: 'unknown_evidence' };
                ids = entry.symptoms[ev.id].service_ids;
            } else return { status: 'unknown', reason: 'bad_request' };

            if (Array.isArray(req.expect_services)) {
                var found = ids.map(toRuntimeService);
                if (JSON.stringify(found) !== JSON.stringify(req.expect_services)) return { status: 'stale', reason: 'runtime_data_differs', expected: req.expect_services.slice(), found: found };
            }

            var decision, because, picked = ids;
            if (ids.length > 1 && action) {
                var typed = ids.filter(function (id) { return entry.services[id].action_label === action; });
                if (typed.length === 1) { decision = 'service'; because = 'action_selects_one'; picked = typed; }
            }
            if (!decision) {
                if (ids.length === 1) { decision = 'service'; because = 'only_service'; }
                else if (ids.length > 1) { decision = 'choose'; because = 'several_services'; }
                else { decision = 'unresolved'; because = 'no_service_mapped'; }
            }
            return {
                status: 'resolved', decision: decision, because: because,
                services: picked.map(function (id) { return describe(entry, id); }),
                source: ids.length ? 'archetype_default' : 'fallback',
                evidence: { group_id: req.group_id, kind: ev.kind, id: ev.kind === 'none' ? null : ev.id },
                action: action
            };
        }

        return { available: true, reason: null, detail: null, provenance: provenance, resolveTap: resolveTap };
    }

    // ---- the page's one installed instance ------------------------------------------------------------------------------------------------------------------------------------------
    // current() never returns null: before anything is installed it is an unavailable resolver ('missing'), so a caller asks it and branches on the answer's `status`, and never on whether it exists.
    var installed = unavailable('missing', 'no artifact has been installed');
    function install(instance) { installed = instance && typeof instance.resolveTap === 'function' ? instance : unavailable('missing', 'install() was given no resolver'); return installed; }
    function current() { return installed; }

    return { create: create, install: install, current: current, toArtifactGroup: toArtifactGroup, toArtifactComponent: toArtifactComponent, toRuntimeService: toRuntimeService };
});
