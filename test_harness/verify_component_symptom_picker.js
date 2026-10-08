#!/usr/bin/env node
/**
 * verify_component_symptom_picker.js
 *
 * Real, full-document, jsdom-based end-to-end test for the real
 * Action -> Component/Symptom navigation flow (Track A / Phase 8),
 * matching this project's own established discipline (T50/T70/T75) of
 * testing UI behavior via a real, simulated DOM, not just a regex check
 * against the source.
 *
 * Covers the exact, real sequence directly requested:
 *   Group -> showServiceTypesForGroup (real Action tiles, from
 *   dynamic_service_types) -> showComponentOrSymptomForGroup (real
 *   component/symptom tiles, scoped by the group's real
 *   routing_archetype) -> resolves to the matching real, named service.
 *
 * Four real groups, each testing a genuinely different real shape:
 *   - Doors (component_first, single service per component): confirms
 *     the flow works end-to-end even when the resolved service's own
 *     service_type ("Install") doesn't literally match the tapped
 *     action ("Repair") -- the component-only fallback correctly wins.
 *   - Toilets (component_first, one shared service across two
 *     components, plus a real, now-closed gap): confirms multi-
 *     component-one-service resolution and the "Something else"
 *     fallback's real, remaining scope.
 *   - Computer Repair (symptom_first, genuine multi-service symptoms):
 *     the real test of *why* the Action step matters -- the same
 *     symptom (wont_power_on) must resolve to two DIFFERENT, correct
 *     services depending on which action was tapped first.
 *   - Cabinets & Drawers (component_first, replacing a generic "Other"
 *     tile presentation): the real test of the project's core
 *     philosophy -- not authoring a bespoke named service for every
 *     conceivable request, but expanding real component vocabulary
 *     (hinge, handle, shelf) onto the two existing, real services that
 *     already, honestly cover them.
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require(path.join(__dirname, 'node_modules', 'jsdom'));

const REPO_ROOT = path.dirname(__dirname);
const QR_HTML_PATH = path.join(REPO_ROOT, 'qr.html');
const BTNYC_JSON_PATH = path.join(REPO_ROOT, 'btnyc.json');

let pass = 0, fail = 0;
function check(label, condition) {
    if (condition) { pass++; console.log(`  ✓ ${label}`); }
    else { fail++; console.log(`  ✗ ${label}`); }
}

const html = fs.readFileSync(QR_HTML_PATH, 'utf8');
const btnycJson = fs.readFileSync(BTNYC_JSON_PATH, 'utf8');
const consoleErrors = [];
const windowErrors = [];

const dom = new JSDOM(html, {
    url: 'https://tommichael88.github.io/booktomnyc/qr.html',
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true,
    beforeParse(window) {
        window.fetch = async (url) => {
            if (String(url).includes('btnyc.json')) return { ok: true, json: async () => JSON.parse(btnycJson) };
            return { ok: false, status: 404 };
        };
        window.HTMLElement.prototype.scrollIntoView = function () {};
        window.console.error = (...args) => consoleErrors.push(args.join(' '));
        window.addEventListener('error', (e) => windowErrors.push(e.message));
    },
});

function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function tiles(doc) {
    return [...(doc.getElementById('serviceContainer')?.querySelectorAll('.group-tile') || [])];
}
function tileLabels(doc) {
    return tiles(doc).map(t => t.querySelector('.tile-name')?.textContent || '');
}
function findTile(doc, re) {
    return tiles(doc).find(t => re.test(t.querySelector('.tile-name')?.textContent || ''));
}
// A multi-match component/symptom tap (e.g. comp.tv's 2 real services)
// falls through to renderServices, which produces .service-tile elements
// (display name in an <h4>) -- a genuinely different structure than the
// .group-tile picker tiles above, confirmed directly against
// createServiceCardElement rather than assumed to share a selector.
function serviceTiles(doc) {
    return [...(doc.getElementById('serviceContainer')?.querySelectorAll('.service-tile') || [])];
}
function findServiceTile(doc, re) {
    return serviceTiles(doc).find(t => re.test(t.querySelector('h4')?.textContent || ''));
}
function tap(t, w) {
    t.dispatchEvent(new w.Event('click', { bubbles: true }));
}

(async () => {
    const w = await wait(3000).then(() => dom.window);
    const doc = w.document;

    console.log('=== App initializes cleanly with the new Action-step code present ===');
    check('zero console.error calls during init', consoleErrors.length === 0);
    if (consoleErrors.length) consoleErrors.forEach(e => console.log('    console.error:', e));
    check('zero uncaught window errors during init', windowErrors.length === 0);
    check('showServiceTypesForGroup is defined', typeof w.showServiceTypesForGroup === 'function');
    check('renderComponentSymptomPicker is defined', typeof w.renderComponentSymptomPicker === 'function');
    check('resolveComponentSymptomTap is defined', typeof w.resolveComponentSymptomTap === 'function');

    console.log('\n=== Doors: real Action tiles shown FIRST, matching dynamic_service_types ===');
    const doorsGroup = w.DB.group.find(g => g.id === 'minor_home_repairs_doors');
    check('Doors group exists in the real catalog', !!doorsGroup);
    w.showSubGroups(doorsGroup, 'minor_home_repairs');
    await wait(50);
    // T72 FIX: was 3 (Diagnostic/Mount/Repair). Diagnostic and Mount were
    // both confirmed, real dead ends for this group -- neither ever led to
    // a real service (verified by directly replicating
    // renderComponentSymptomPicker's own bypass logic, not assumed), so
    // tapping either fell through to the same 4 door-component tiles
    // regardless, none of which actually led anywhere for those two
    // "actions." dynamic_service_types corrected to ['Repair', 'Install']
    // (Install added back -- also real, was simply missing from the
    // original list entirely). See TIMELINE.md's T72 entry.
    check('exactly 2 real action tiles render (Repair/Install)', tiles(doc).length === 2);
    check('a real "Fix / Repair" action label is present (from the established BLD_ACTION_MAP, not invented)',
        tileLabels(doc).some(l => /repair/i.test(l)));
    check('no component tiles are shown yet (Action is a real, separate first step)',
        !tileLabels(doc).some(l => /door lock|deadbolt/i.test(l)));

    console.log('\n=== Tapping "Repair" reveals the real component step, matching the exact requested sequence ===');
    tap(findTile(doc, /repair/i), w);
    await wait(50);
    check('exactly 5 tiles now render (4 real components + 1 fallback)', tiles(doc).length === 5);
    check('a real "Door lock" component tile is present', tileLabels(doc).some(l => /door lock/i.test(l)));
    check('the picker prompt ("Which part?") is present, confirming component_first framing', /which part/i.test(doc.getElementById('serviceContainer').textContent));

    console.log('\n=== Tapping "Door lock" resolves to the correct real service, exactly as requested ===');
    tap(findTile(doc, /door lock/i), w);
    await wait(50);
    check('resolves to door_lock_or_handle_install (component-only fallback correctly used, since this service\'s own service_type is "Install", not "Repair")',
        w.S?.svc?.id === 'door_lock_or_handle_install' || w.S?._svc?.id === 'door_lock_or_handle_install');

    console.log('\n=== Toilets: real Action tiles, then real components including the closed "toilet seat" gap ===');
    const toiletsGroup = w.DB.group.find(g => g.id === 'plumbing_help_toilets');
    w.showSubGroups(toiletsGroup, 'plumbing_help');
    await wait(50);
    // T72 FIX: was "Diagnostic/Install" -- Diagnostic was confirmed a real
    // dead end (never led anywhere useful), Repair was confirmed real but
    // missing entirely from the original list. Count stays 2; only the
    // labels changed. See TIMELINE.md's T72 entry.
    check('exactly 2 real action tiles render (Install/Repair)', tiles(doc).length === 2);
    tap(findTile(doc, /install/i), w);
    await wait(50);
    check('exactly 7 tiles render (6 real components + 1 fallback)', tiles(doc).length === 7);
    check('the real "Toilet seat" tile is present (the gap closed in v9.6.6)', tileLabels(doc).some(l => /toilet seat/i.test(l)));
    tap(findTile(doc, /toilet seat/i), w);
    await wait(50);
    check('resolves directly to the real, new toilet_seat_replacement service',
        w.S?.svc?.id === 'toilet_seat_replacement' || w.S?._svc?.id === 'toilet_seat_replacement');

    console.log('\n=== Two different components mapping to the SAME real service both resolve correctly (post-Action-step) ===');
    w.showSubGroups(toiletsGroup, 'plumbing_help');
    await wait(50);
    tap(findTile(doc, /install/i), w);
    await wait(50);
    tap(findTile(doc, /flapper/i), w);
    await wait(50);
    check('flapper resolves to toilet_flapper_or_fill_valve_replacement',
        w.S?.svc?.id === 'toilet_flapper_or_fill_valve_replacement' || w.S?._svc?.id === 'toilet_flapper_or_fill_valve_replacement');

    console.log('\n=== "Something else" still gives a genuine next step for the real, remaining unpredictable case ===');
    w.showSubGroups(toiletsGroup, 'plumbing_help');
    await wait(50);
    tap(findTile(doc, /install/i), w);
    await wait(50);
    tap(findTile(doc, /something else/i), w);
    await wait(50);
    const builder = doc.getElementById('sqBuilder');
    check('tapping it opens the real, pre-seeded builder', builder && builder.style.display === 'block');
    const repairChip = [...doc.querySelectorAll('.sq-b-chip')].find(c => /fix.*repair/i.test(c.textContent));
    if (repairChip) {
        repairChip.click();
        await wait(50);
        const sentence = doc.getElementById('sqBuilderSentence')?.textContent || '';
        check('the builder sentence genuinely reflects the pre-seeded group ("Toilets")', /toilets/i.test(sentence));
    }

    console.log('\n=== Computer Repair (symptom_first): real Action tiles show symptoms, not components, per the real archetype ===');
    const compGroup = w.DB.group.find(g => g.id === 'tech_trouble_computer_repair');
    check('Computer Repair group exists in the real catalog', !!compGroup);
    w.showSubGroups(compGroup, 'tech_trouble');
    await wait(50);
    // T72 FIX: was 4 (Diagnostic/Install/Setup/Repair). Install confirmed
    // a real dead end for this group -- no computer-repair symptom or
    // component ever led to an Install-type service; removed. The other
    // 3 (Diagnostic/Setup/Repair, all confirmed real) are unaffected. See
    // TIMELINE.md's T72 entry.
    check('3 real action tiles render (Diagnostic/Setup/Repair)',
        tiles(doc).length === 3);
    tap(findTile(doc, /set up/i), w);
    await wait(50);
    check('symptom tiles render (not components), matching the real symptom_first archetype', tileLabels(doc).some(l => /virus/i.test(l)));
    check('the picker prompt ("What\'s happening?") is present, confirming symptom_first framing',
        /what.s happening/i.test(doc.getElementById('serviceContainer').textContent));
    tap(findTile(doc, /virus/i), w);
    await wait(50);
    check('Virus resolves to virus_or_malware_removal', w.S?.svc?.id === 'virus_or_malware_removal' || w.S?._svc?.id === 'virus_or_malware_removal');

    console.log('\n=== THE CORE VALUE PROPOSITION: the SAME symptom resolves to DIFFERENT, correct services depending on the chosen Action ===');
    {
        w.showSubGroups(compGroup, 'tech_trouble');
        await wait(50);
        tap(findTile(doc, /repair/i), w);
        await wait(50);
        check('a real "wont_power_on" symptom tile is present under Repair', tileLabels(doc).some(l => /power on/i.test(l)));
        tap(findTile(doc, /power on/i), w);
        await wait(50);
        const viaRepair = w.S?.svc?.id || w.S?._svc?.id;
        check('via Repair, wont_power_on resolves to computer_diagnostic', viaRepair === 'computer_diagnostic');

        w.showSubGroups(compGroup, 'tech_trouble');
        await wait(50);
        tap(findTile(doc, /set up/i), w);
        await wait(50);
        tap(findTile(doc, /power on/i), w);
        await wait(50);
        const viaSetup = w.S?.svc?.id || w.S?._svc?.id;
        check('via Set up, the SAME symptom instead resolves to system_restore_or_reset', viaSetup === 'system_restore_or_reset');
        check('the two resolutions are genuinely different services (the real reason the Action step exists)', viaRepair !== viaSetup && !!viaRepair && !!viaSetup);
    }

    console.log('\n=== Cabinets & Drawers: replacing the generic "Other" tile with real, expanded component coverage ===');
    {
        const cabGroup = w.DB.group.find(g => g.id === 'minor_home_repairs_cabinets_drawers');
        check('Cabinets & Drawers group exists in the real catalog', !!cabGroup);

        // T72 FIX: was tapComponentAfterRepair, tapping "Repair" as a real
        // first step. dynamic_service_types corrected from
        // ['Diagnostic', 'Mount', 'Repair'] (none of which were ever real
        // for this group -- confirmed by direct replication of the app's
        // own bypass logic, not assumed) to ['Install'] (the group's one
        // actual real_action_id, which was missing from the original list
        // entirely). With only one real action, the Action step correctly,
        // now gets skipped altogether (the same established "skip when
        // unambiguous" pattern already used elsewhere) -- showSubGroups
        // goes straight to the component picker. Component-level
        // resolution itself is unaffected: each component still resolves
        // via resolveComponentSymptomTap's single-service-match path
        // regardless of chosenAction being "Install" instead of "Repair".
        // See TIMELINE.md's T72 entry.
        async function tapComponent(re) {
            w.showSubGroups(cabGroup, 'minor_home_repairs');
            await wait(50);
            const tile = findTile(doc, re);
            if (!tile) return null;
            tap(tile, w);
            await wait(50);
            return w.S?.svc?.id || w.S?._svc?.id;
        }

        w.showSubGroups(cabGroup, 'minor_home_repairs');
        await wait(50);
        check('Action step correctly skipped (only one real action now: Install) -- component tiles render directly',
            tileLabels(doc).some(l => /cabinet door|hinge|shelf|knob/i.test(l)));
        check('all 7 real components render (cabinet door, drawer, hinge, shelf, knob, pull, handle) + 1 fallback',
            tiles(doc).length === 8);

        check('Hinge (newly mapped) resolves to cabinet_door_or_drawer_adjustment',
            await tapComponent(/hinge/i).then(id => id === 'cabinet_door_or_drawer_adjustment'));
        check('Handle (newly mapped, despite "handle" alone colliding with door hardware elsewhere) resolves to cabinet_knob_or_pull_install',
            await tapComponent(/handle/i).then(id => id === 'cabinet_knob_or_pull_install'));
        check('Shelf (newly mapped, despite "shelf" alone colliding with wall-shelf-mounting elsewhere) resolves to cabinet_door_or_drawer_adjustment',
            await tapComponent(/shelf/i).then(id => id === 'cabinet_door_or_drawer_adjustment'));
        check('Knob (pre-existing) still resolves to cabinet_knob_or_pull_install',
            await tapComponent(/^knob$/i).then(id => id === 'cabinet_knob_or_pull_install'));
        check('Cabinet door (pre-existing) still resolves to cabinet_door_or_drawer_adjustment',
            await tapComponent(/cabinet door/i).then(id => id === 'cabinet_door_or_drawer_adjustment'));
    }

    console.log('\n=== The same "cabinet X" vocabulary also resolves correctly via free text, not just the picker ===');
    {
        const nlpCases = [
            ['my cabinet hinge is squeaky', 'cabinet_door_or_drawer_adjustment'],
            ['need a new cabinet handle', 'cabinet_knob_or_pull_install'],
            ['my cabinet shelf is broken', 'cabinet_door_or_drawer_adjustment'],
            // the exact, generic terms these compound phrases could have collided
            // with must still resolve to THEIR original, correct targets
            ['my door hinge is squeaky', 'door_lock_or_handle_install'],
            ['need a new door handle', 'door_lock_or_handle_install'],
            ['mount a floating shelf', 'shelf_mounting_standard_buy_the_hour'],
        ];
        for (const [phrase, expected] of nlpCases) {
            const r = w.detectIntentNLP(phrase);
            check(`${JSON.stringify(phrase)} -> ${expected}`, r.recommendedSku === expected);
        }
    }

    console.log('\n=== Appliances cluster: closing real, explicit gaps with pattern-matched services, not bespoke ones ===');
    {
        async function checkAction(gid, actionRe) {
            const g = w.DB.group.find(x => x.id === gid);
            w.showSubGroups(g, 'minor_home_repairs');
            await wait(30);
            const t = findTile(doc, actionRe);
            tap(t, w);
            await wait(30);
        }

        // Washer already had both real services before this round -- the
        // baseline "does the picker work when nothing needed closing" case.
        await checkAction('minor_home_repairs_appliances_washer', /^install$/i);
        check('Washer: Install resolves directly to washer_install (unambiguous action, no symptom to tap)',
            (w.S?.svc?.id || w.S?._svc?.id) === 'washer_install');

        // Dishwasher and Refrigerator: real, authored install services,
        // pattern-matched to washer_install (same description, same $70)
        await checkAction('minor_home_repairs_appliances_dishwasher', /^install$/i);
        check('Dishwasher: Install resolves directly to the newly-authored dishwasher_install',
            (w.S?.svc?.id || w.S?._svc?.id) === 'dishwasher_install');
        await checkAction('minor_home_repairs_appliances_dishwasher', /fix.*repair/i);
        check('Dishwasher: Repair still shows the real symptom picker (not skipped, unlike Install)',
            tileLabels(doc).some(l => /wont drain/i.test(l)));

        await checkAction('minor_home_repairs_appliances_refrigerator', /^install$/i);
        check('Refrigerator: Install resolves directly to the newly-authored refrigerator_install',
            (w.S?.svc?.id || w.S?._svc?.id) === 'refrigerator_install');

        // Window AC: the inverse gap (had install, was missing repair) --
        // and the one real, genuine multi-service component in this
        // cluster (comp.window_ac maps to both), proving the action-
        // disambiguation logic (already proven for Computer Repair)
        // generalizes correctly here too. Updated for the single-tile
        // friction fix below: this group has exactly one real component,
        // so it now correctly auto-resolves straight through after the
        // Action tap -- no separate, redundant "Window AC" tap needed
        // (there was never a real choice at that step: one component,
        // and the Action already, unambiguously picks which of its two
        // real services is meant).
        await checkAction('minor_home_repairs_appliances_window_ac', /^install$/i);
        check('Window AC: Install auto-resolves straight through to window_ac_setup (single real component, no redundant tap)',
            (w.S?.svc?.id || w.S?._svc?.id) === 'window_ac_setup');
        await checkAction('minor_home_repairs_appliances_window_ac', /fix.*repair/i);
        check('Window AC: Repair auto-resolves to the newly-authored window_ac_repair instead, same one-tap flow',
            (w.S?.svc?.id || w.S?._svc?.id) === 'window_ac_repair');
    }

    console.log('\n=== The same appliance vocabulary resolves correctly via free text too ===');
    {
        function resolveFreeText(phrase) {
            const ctx = w.collectBookingContext_freeText(phrase);
            const route = w.executeWorkflow(ctx, w.DB);
            return route.entity?.id;
        }
        const cases = [
            ['my dishwasher wont drain', 'dishwasher_repair'],
            ['need a new dishwasher installed', 'dishwasher_install'],
            ['need a new fridge hookup', 'refrigerator_install'],
            ['my fridge is leaking', 'repair_appliances'],
            ['install a window ac', 'window_ac_setup'],
            ['my window ac is broken', 'window_ac_repair'],
            ['need a new washer', 'washer_install'],
            ['my washer wont spin', 'washer_repair'],
        ];
        for (const [phrase, expected] of cases) {
            check(`${JSON.stringify(phrase)} -> ${expected}`, resolveFreeText(phrase) === expected);
        }
    }

    console.log('\n=== Electric Lighting cluster: two real, same-service_type multi-service cases ===');
    {
        async function show(gid) {
            const g = w.DB.group.find(x => x.id === gid);
            w.showSubGroups(g, 'electric_lighting');
            await wait(30);
        }

        // Straightforward groups, zero gaps
        await show('electric_lighting_fans');
        check('Fans: 2 real components + fallback render', tiles(doc).length === 3);
        tap(findTile(doc, /ceiling fan/i), w);
        await wait(30);
        check('Ceiling fan resolves to ceiling_fan_install', (w.S?.svc?.id || w.S?._svc?.id) === 'ceiling_fan_install');

        await show('electric_lighting_switches');
        tap(findTile(doc, /dimmer/i), w);
        await wait(30);
        check('Dimmer switch resolves to dimmer_switch_install', (w.S?.svc?.id || w.S?._svc?.id) === 'dimmer_switch_install');

        await show('electric_lighting_thermostats');
        check('Thermostat auto-resolves straight through (single real component, no redundant tap)',
            (w.S?.svc?.id || w.S?._svc?.id) === 'thermostat_replacement');

        // The real bug found and fixed in this round: two services sharing
        // the SAME service_type (both "Install") were being silently,
        // wrongly resolved via .find() picking the first one, never
        // letting the customer choose. Both real cases verified directly.
        // Updated for the single-tile friction fix: Bulbs has exactly one
        // real component, so the redundant "Bulb" tile itself is now
        // skipped entirely -- the real, genuine 2-service choice shows
        // immediately after the group tap, not after an extra, pointless
        // tap on a tile with the same name as the group just tapped.
        await show('electric_lighting_bulbs');
        const beforeBulbShow = w.S?.svc?.id || w.S?._svc?.id;
        check('Bulbs: the real 2-service choice shows immediately, no redundant "Bulb" tile tap first',
            /led bulb upgrade/i.test(doc.getElementById('serviceContainer').textContent) &&
            /high ceiling bulb replacement/i.test(doc.getElementById('serviceContainer').textContent));
        check('Showing the real choice does NOT silently resolve either option (still a genuine, open choice)',
            (w.S?.svc?.id || w.S?._svc?.id) === beforeBulbShow);

        await show('electric_lighting_light_fixtures');
        check('Light Fixtures: 4 real components + fallback render', tiles(doc).length === 5);
        tap(findTile(doc, /pendant/i), w);
        await wait(30);
        check('Pendant tap shows BOTH chandelier_or_pendant_install and light_fixture_replacement as a choice',
            /chandelier or pendant install/i.test(doc.getElementById('serviceContainer').textContent) &&
            /light fixture replacement/i.test(doc.getElementById('serviceContainer').textContent));
        // Re-navigate: the pendant tap above rendered service cards (via
        // renderServices), not .group-tile elements -- a fresh pass through
        // the group is needed before tapping a genuinely different, single-
        // service component tile.
        await show('electric_lighting_light_fixtures');
        tap(findTile(doc, /chandelier/i), w);
        await wait(30);
        check('Chandelier (single-service component) still resolves directly', (w.S?.svc?.id || w.S?._svc?.id) === 'chandelier_or_pendant_install');

        // Confirm the DIFFERENT-service_type disambiguation (the original,
        // correct use of this mechanism) still works after the fix.
        const compGroup = w.DB.group.find(x => x.id === 'tech_trouble_computer_repair');
        w.showSubGroups(compGroup, 'tech_trouble');
        await wait(30);
        tap(findTile(doc, /repair/i), w);
        await wait(30);
        tap(findTile(doc, /power on/i), w);
        await wait(30);
        check('Regression check: different-service_type disambiguation (Computer Repair) still resolves directly and correctly',
            (w.S?.svc?.id || w.S?._svc?.id) === 'computer_diagnostic');
    }

    console.log('\n=== Plumbing Help cluster: a real service hidden behind symptoms, and a whole group reclassified to expose real components ===');
    {
        async function show(gid) {
            const g = w.DB.group.find(x => x.id === gid);
            w.showSubGroups(g, 'plumbing_help');
            await wait(30);
        }

        // Sinks: a real service (leak_under_sink_repair) was only ever
        // reachable via symptoms, structurally invisible under this
        // component_first archetype -- and NOT rescued by the unambiguous-
        // skip check, since the normally-shown Repair component
        // (faucet_repair_drip) already, correctly satisfies the Repair
        // action. Exposed as its own, direct component tile instead.
        await show('plumbing_help_sinks');
        // T72 FIX: was 3 (Diagnostic/Install/Repair). Diagnostic confirmed
        // a real dead end for this group (never led anywhere useful);
        // removed. Install/Repair (both already real) unaffected. See
        // TIMELINE.md's T72 entry.
        check('Sinks: 2 real action tiles render (Install/Repair)',
            tiles(doc).length === 2);
        tap(findTile(doc, /fix.*repair/i), w);
        await wait(30);
        check('Sink leak is now a real, direct, distinct tile (was structurally unreachable via the picker before this round)',
            tileLabels(doc).some(l => /sink leak/i.test(l)));
        tap(findTile(doc, /sink leak/i), w);
        await wait(30);
        check('Sink leak resolves to the correct, previously-hidden leak_under_sink_repair',
            (w.S?.svc?.id || w.S?._svc?.id) === 'leak_under_sink_repair');

        await show('plumbing_help_sinks');
        tap(findTile(doc, /^install$/i), w);
        await wait(30);
        tap(findTile(doc, /p trap/i), w);
        await wait(30);
        check('P trap (via Install) still resolves correctly', (w.S?.svc?.id || w.S?._svc?.id) === 'p_trap_cleaning');

        // Showers & Tubs: reclassified from symptom_first to component_first
        // -- 2 real components (shower_head, tub_spout) were structurally
        // invisible under the old classification, since it only ever
        // displayed the 2 real symptoms (both collapsing to one service).
        // All 3 real destinations verified reachable after reclassifying.
        // T72 FIX: dynamic_service_types was ['Diagnostic', 'Install'];
        // Diagnostic confirmed a real dead end, removed, leaving only
        // ['Install'] -- with just one real action, the Action step now
        // correctly skips entirely (the established "skip when
        // unambiguous" pattern), going straight to the component picker.
        // The explicit "Install" tap is no longer needed or possible. See
        // TIMELINE.md's T72 entry.
        await show('plumbing_help_showers_tubs');
        check('Showers/Tubs: all 3 real destinations now visible as tiles (shower head, tub spout, slow drain)',
            tileLabels(doc).some(l => /shower head/i.test(l)) &&
            tileLabels(doc).some(l => /tub spout/i.test(l)) &&
            tileLabels(doc).some(l => /slow drain/i.test(l)));
        tap(findTile(doc, /shower head/i), w);
        await wait(30);
        check('Shower head resolves correctly', (w.S?.svc?.id || w.S?._svc?.id) === 'shower_head_replacement');

        // Water Lines, Garbage Disposals: straightforward, single real
        // component each.
        // T72 FIX: both previously kept extra dynamic_service_types
        // (Diagnostic/Mount) specifically to serve the old "Other tile"
        // mechanism -- but both were confirmed genuine dead ends there
        // too (neither ever led to a real service via any real path), so
        // removing them is correct, not a regression: both groups now
        // correctly skip the Action step entirely (only one real action:
        // Install), going straight to resolution. The explicit "Install"
        // taps are no longer needed or possible. See TIMELINE.md's T72
        // entry.
        await show('plumbing_help_water_lines');
        check('Water line auto-resolves, no redundant Action or component tap', (w.S?.svc?.id || w.S?._svc?.id) === 'refrigerator_water_line_install');

        await show('plumbing_help_garbage_disposals');
        check('Garbage disposal auto-resolves, no redundant Action or component tap', (w.S?.svc?.id || w.S?._svc?.id) === 'garbage_disposal_replacement');
    }

    console.log('\n=== The same newly-exposed plumbing vocabulary resolves correctly via free text too ===');
    {
        function resolveFreeText(phrase) {
            const ctx = w.collectBookingContext_freeText(phrase);
            const route = w.executeWorkflow(ctx, w.DB);
            return route.entity?.id;
        }
        const cases = [
            ['I have a leak under my sink', 'leak_under_sink_repair'],
            ['my faucet is dripping', 'faucet_repair_drip'],
            ['my shower head needs replacing', 'shower_head_replacement'],
            ['run a fridge water line', 'refrigerator_water_line_install'],
            ['need a new garbage disposal', 'garbage_disposal_replacement'],
            // regression check: the original, unrelated fridge intent must
            // still resolve correctly after raising water line's weight
            ['my fridge is leaking', 'repair_appliances'],
        ];
        for (const [phrase, expected] of cases) {
            check(`${JSON.stringify(phrase)} -> ${expected}`, resolveFreeText(phrase) === expected);
        }
    }

    console.log('\n=== Wall Mounting cluster: category-complete round (substrate-first navigation, confirmed intentional) ===');
    {
        async function show(gid) {
            const g = w.DB.group.find(x => x.id === gid);
            w.showSubGroups(g, 'wall_mounting');
            await wait(30);
        }

        // Corrected mid-session, from direct domain input: this is NOT a
        // flat category. wall_mounting_drywall_or_plaster is a real,
        // intentional substrate-selection parent -- "what's your wall
        // made of" is asked BEFORE "what are you mounting", so
        // blinds_curtain/frames_shelves/tv_flatscreen (drywall-substrate
        // items) correctly nest under it, while brick_or_concrete
        // (itself already substrate-specific) correctly stays flat,
        // top-level. An earlier pass here mistook the nesting for a data
        // bug and removed it; reverted, and this section now verifies
        // the REAL, intended two-level flow instead.
        w.showGroupsForCategory('wall_mounting');
        await wait(30);
        check('Top level shows exactly the 2 real substrate choices (Drywall or Plaster, Brick or Concrete) -- NOT the 3 drywall-nested groups directly',
            tileLabels(doc).some(l => /drywall/i.test(l)) &&
            tileLabels(doc).some(l => /brick or concrete/i.test(l)) &&
            !tileLabels(doc).some(l => /^blinds/i.test(l)) &&
            !tileLabels(doc).some(l => /^tv flatscreen/i.test(l)));

        tap(findTile(doc, /drywall/i), w);
        await wait(30);
        check('Tapping "Drywall or Plaster" reveals its 3 real children as the second navigation step',
            tileLabels(doc).some(l => /blinds/i.test(l)) &&
            tileLabels(doc).some(l => /frames/i.test(l)) &&
            tileLabels(doc).some(l => /tv flatscreen/i.test(l)));
        tap(findTile(doc, /tv flatscreen/i), w);
        await wait(30);
        check('Tapping a nested child (TV Flatscreen) correctly reaches the real leaf/picker behavior despite the extra nesting depth',
            tiles(doc).length === 4 && tileLabels(doc).some(l => /^tv$/i.test(l)));

        // Note: dynamic_service_types is genuinely 'Mount' here, not a
        // mislabeling -- confirmed directly (not assumed) after an
        // initial, incorrect pattern-match against T30's electric_lighting
        // fix: 'Mount' is a real, structurally-supported action category
        // used in 22 dynamic_services keys across 3 categories
        // (wall_mounting, minor_home_repairs, plumbing_help), including
        // already-shipped, working groups like Doors and Cabinets &
        // Drawers -- it doesn't need to literally match any real
        // service's own service_type (Doors' real services are all
        // "Install" too), since it correctly falls through to the
        // dynamic-service fallback when no named service matches.
        // electric_lighting's case was genuinely different: zero
        // supporting +Mount infrastructure existed anywhere for it, a
        // real, isolated mislabeling -- not the same situation as here.

        // Blinds/Curtains: single real component -- the established
        // single-tile friction fix applies (matches Thermostats/Water
        // Lines), auto-resolves with zero extra taps.
        await show('wall_mounting_blinds_curtain');
        check('Blinds/Curtains auto-resolves straight through (single real component, no redundant tap, no Action step since dynamic_service_types has exactly one real type)',
            (w.S?.svc?.id || w.S?._svc?.id) === 'blinds_shades_curtains_buy_the_hour');

        // Brick or Concrete vs Frames | Shelves: a genuine, real test of
        // GROUP-scoped resolution -- both groups share the exact same 3
        // component IDs (comp.shelf, comp.frame, comp.mirror), and each
        // must resolve to its OWN group's real, different (masonry vs.
        // standard) service, never the sibling group's.
        await show('wall_mounting_brick_or_concrete');
        check('Brick or Concrete: 3 real components + fallback render, no Action step', tiles(doc).length === 4);
        tap(findTile(doc, /shelf/i), w);
        await wait(30);
        check('Brick or Concrete\'s shelf resolves to the masonry-specific shelf_mortar_mounting_buy_the_hour',
            (w.S?.svc?.id || w.S?._svc?.id) === 'shelf_mortar_mounting_buy_the_hour');

        await show('wall_mounting_frames_shelves');
        check('Frames | Shelves: 3 real components + fallback render', tiles(doc).length === 4);
        tap(findTile(doc, /shelf/i), w);
        await wait(30);
        check('The SAME comp.shelf ID, in the standard-wall group, correctly resolves to the DIFFERENT shelf_mounting_standard_buy_the_hour (not the masonry service)',
            (w.S?.svc?.id || w.S?._svc?.id) === 'shelf_mounting_standard_buy_the_hour');
        await show('wall_mounting_frames_shelves');
        tap(findTile(doc, /mirror/i), w);
        await wait(30);
        check('Mirror (same group) also correctly resolves to shelf_mounting_standard_buy_the_hour', (w.S?.svc?.id || w.S?._svc?.id) === 'shelf_mounting_standard_buy_the_hour');

        // TV Flatscreen: the real, genuine multi-match case (one of 8
        // catalog-wide) -- comp.tv maps to TWO distinct, real services.
        // No chosenAction ever disambiguates it (this group has exactly
        // one real action type), so this must correctly fall through to
        // the multi-match sub-picker, never silently guess.
        await show('wall_mounting_tv_flatscreen');
        check('TV Flatscreen: 3 real components + fallback render', tiles(doc).length === 4);
        tap(findTile(doc, /^tv$/i), w);
        await wait(30);
        check('Tapping TV correctly shows BOTH real destinations as a genuine choice (no chosenAction to disambiguate them, correctly falls through to the service-card sub-picker)',
            /flatscreen mounting \(standard\)/i.test(doc.getElementById('serviceContainer').textContent) &&
            /flatscreen mounting with hidden cables/i.test(doc.getElementById('serviceContainer').textContent));
        tap(findServiceTile(doc, /hidden cables/i), w);
        await wait(30);
        check('Tapping the specific "hidden cables" option resolves to the correct, specific service',
            (w.S?.svc?.id || w.S?._svc?.id) === 'flatscreen_mounting_with_hidden_cables');

        await show('wall_mounting_tv_flatscreen');
        tap(findTile(doc, /monitor/i), w);
        await wait(30);
        check('Monitor (single-service component) resolves directly', (w.S?.svc?.id || w.S?._svc?.id) === 'flatscreen_mounting_standard');

        await show('wall_mounting_tv_flatscreen');
        tap(findTile(doc, /cable/i), w);
        await wait(30);
        check('Cables resolves to cable_management', (w.S?.svc?.id || w.S?._svc?.id) === 'cable_management');
    }

    console.log('\n=== The same wall-mounting vocabulary still resolves correctly via free text (regression, not new coverage) ===');
    {
        function resolveFreeText(phrase) {
            const ctx = w.collectBookingContext_freeText(phrase);
            const route = w.executeWorkflow(ctx, w.DB);
            return route.entity?.id;
        }
        const cases = [
            ['put a curtain rod up', 'blinds_shades_curtains_buy_the_hour'],
            ['I need to hang a mirror', 'shelf_mounting_standard_buy_the_hour'],
            ['mount a flatscreen tv', 'flatscreen_mounting_standard'],
            ['help organizing my cables', 'cable_management'],
        ];
        for (const [phrase, expected] of cases) {
            check(`${JSON.stringify(phrase)} -> ${expected}`, resolveFreeText(phrase) === expected);
        }
        // Honest, confirmed, NOT-fixed gap: free text has no real coverage
        // path to the masonry-specific shelf_mortar_mounting_buy_the_hour
        // -- 'shelf'/'mirror'/'mount' all route to the standard-wall
        // service regardless of wall material, and 'brick'/'concrete'
        // route to the unrelated brick_or_concrete_crack_repair. Fixing
        // this needs real AND-logic (object type AND wall material) the
        // current contextual_overrides mechanism (OR-only within one
        // entry, first-match-wins across entries) doesn't cleanly
        // support without risky reordering across independently-scored
        // keyword entries -- flagged honestly rather than forced. Catalog
        // navigation (this round's actual scope) is unaffected.
        check('Confirmed, NOT fixed: free text has no path to shelf_mortar_mounting_buy_the_hour (documented gap, not silently ignored)',
            resolveFreeText('mount a shelf on my brick wall') !== 'shelf_mortar_mounting_buy_the_hour');
    }

    console.log('\n=== Every other, non-allowlisted real group remains completely unaffected ===');
    {
        let checkedGroups = 0, stillUsesFlatGrid = 0;
        // v9.6.14+ FIX: wall_mounting_frames_shelves/tv_flatscreen just
        // became genuinely allowlisted this round -- swapped for two
        // other, still-untouched real groups, matching the exact,
        // established precedent (v9.6.12 swapped electric_lighting_bulbs
        // out the same way once IT became allowlisted).
        const sampleGroups = ['minor_home_repairs_furniture', 'minor_home_repairs_walls', 'tech_trouble_smart_home', 'tech_trouble_networking'];
        for (const gid of sampleGroups) {
            const g = w.DB.group.find(x => x.id === gid);
            if (!g) continue;
            checkedGroups++;
            w.showSubGroups(g, g.category_id);
            await wait(30);
            const c = doc.getElementById('serviceContainer');
            if (c && c.querySelectorAll('.service-card, .service-group-header').length > 0) stillUsesFlatGrid++;
        }
        check(`all ${checkedGroups} sampled, non-allowlisted groups still use the original flat grid (zero unintended change)`,
            checkedGroups > 0 && stillUsesFlatGrid === checkedGroups);
    }

    console.log(`\n[Action -> Component/Symptom picker verification] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
    process.exit(fail > 0 ? 1 : 0);
})();
