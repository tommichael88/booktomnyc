#!/usr/bin/env node
/**
 * verify_computer_repair_intake.js -- Tech Trouble > Computer Repair asks the customer only what they have not already told us, and asks it well.
 *
 * @enforces P-CLIENT-NAVFACT
 * @enforces P-INTAKE-INFER
 * @enforces R-INTAKE-WIREREMOVE
 * @enforces P-WHITEFLAG-PRICED
 * @enforces R-SYSTEM-PICKER-AGREE
 *
 * THE DEFECT (operator, 2026-10-11 04:57 NY, PENDING_DECISIONS #180): "in this flow I see we ask currently Computer Repair > then grid with symptoms like Won't power on > we then open the sqintake
 * questions and ASK THEM AGAIN... this is wrong... should be more targeted questions... Desktop/Laptop then show corresponding questions, but again they need to be quality and specific like the
 * Charter states." Driven on the real page before the fix: the symptom tile "Wont power on" (a humanised id, apostrophe lost) opened Computer Diagnostic, whose card asked "What type of computer?" and then
 * "What's the issue with the computer?" -- a nine-answer list that contains the symptom the customer had just tapped. The same card, from the free-text bar, asked both questions again for "my laptop won't
 * turn on". Nothing in the chain could tell a laptop that is only a dead charger from a desktop that has lost its power supply, so every hardware symptom ended in the $231 diagnostic, which costs
 * more than every repair it diagnoses.
 *
 * The Charter (Part VI, P-INTAKE-INFER / P-CLIENT-NAVFACT): a fact the navigation path or the free text already supplied is not asked again; (R-INTAKE-WIREREMOVE) a question stays only if its answer changes the
 * price, the time, a branch or the prep; (Part VII, P-WHITEFLAG-PRICED) the registered diagnostic is the priced path when remote questions cannot retire the uncertainty -- not the first thing every symptom
 * reaches. The operator's rule for this group: "we go the Diagnostic route here ONLY when we can't retire enough uncertainty to make a definitive analysis for internal_hardware_replacement."
 *
 * MEASURED BY WHAT THE RULES CLAIM (P-GOVERN-GOODHART): the real page (jsdom), driven the way a customer drives it -- every symptom tile, then Laptop or Desktop, then the questions the card shows -- and the
 * real free-text route. It asserts:
 *   1. THE PICKER          The group opens on its symptoms (no Diagnose / Set up / Fix-Repair step in front of them), in the authored words and order, with "I know what I need" beside them and "Something else" last.
 *   2. NO RE-ASK (tiles)   For every symptom tile: what the tile says is on the card as an answer, and no question the tile just answered is shown as unanswered.
 *   3. NO RE-ASK (typing)  For typed phrases that name a device, a symptom or a part: the same.
 *   4. TARGETED            "Won't turn on": Laptop shows only the laptop questions, Desktop only the desktop ones; each observation that names one part routes to that part (battery, charger, power supply),
 *                          the customer is told why, and can take it back; an observation that does not leaves the diagnostic, and the path is never longer than the question cap.
 *   5. THE DIAGNOSTIC IS THE LAST RESORT   Walking every answer of every authored symptom: for each (symptom, device) a definitive part or service is reachable, and no path asks more than the cap.
 *   6. THE CART            A routed request is booked as the part replacement, with the answers that led there.
 * Each section is shown to FAIL on the tree as it stood before T170 Part C (archive/T170_computer_repair_pre.txt).
 *
 * WHAT THIS DOES NOT COVER (named): (a) whether the triage MAPPING is right (which observation means which part) is bench knowledge the operator owns -- it is authored from standard triage practice and
 * filed for a technician's review (#180); this file proves the mapping is asked well and carried, not that it is true. (b) The other symptom-first groups still show a humanised-id grid (#181).
 *
 * RUN ON ANOTHER TREE (G-INVARIANT-PREFIX): BTNYC_ROOT=<tree> node test_harness/verify_computer_repair_intake.js
 */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = process.env.BTNYC_ROOT ? path.resolve(process.env.BTNYC_ROOT) : path.resolve(__dirname, '..');
const { JSDOM } = require(path.join(__dirname, 'node_modules', 'jsdom'));
const { check, finish } = require('./_shared.js');

const GROUP = 'tech_trouble_computer_repair', CAT = 'tech_trouble', HOST = 'computer_diagnostic', PARTS = 'internal_hardware_replacement';
const html = require('./_page.js').readPage(path.join(ROOT, 'qr.html'), ROOT);
const DB = JSON.parse(fs.readFileSync(path.join(ROOT, 'btnyc.json'), 'utf8'));
const errors = [];
const dom = new JSDOM(html, {
    url: 'https://tommichael88.github.io/booktomnyc/qr.html', runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true,
    beforeParse(w) {
        w.fetch = async u => String(u).includes('btnyc.json') ? { ok: true, json: async () => JSON.parse(JSON.stringify(DB)) } : { ok: false, status: 404 };
        w.HTMLElement.prototype.scrollIntoView = function () {};
        w.console.error = (...a) => errors.push(a.join(' '));
        w.addEventListener('error', e => errors.push(e.message));
    },
});
const wait = ms => new Promise(r => setTimeout(r, ms));
const mods = DB.intake_modules;
const labelOf = (mod, re) => { const o = ((mods[mod] || {}).client_response || []).find(x => re.test(x.label)); return o ? o.label : null; };
const routeOf = (mod, label) => { const o = ((mods[mod] || {}).client_response || []).find(x => x.label === label); return o && o.route_to || null; };
const brief = xs => String(JSON.stringify(xs)).slice(0, 400);

(async () => {
    const w = await wait(3000).then(() => dom.window), doc = w.document;
    const group = w.DB.group.find(g => g.id === GROUP);
    const ra = (w.DB.routing_archetypes || {})[GROUP] || {};
    const tiles = () => [...(doc.getElementById('serviceContainer') || { querySelectorAll: () => [] }).querySelectorAll('.group-tile')];
    const tileNames = () => tiles().map(t => (t.querySelector('.tile-name') || {}).textContent || '');
    const tap = el => el.dispatchEvent(new w.Event('click', { bubbles: true }));
    const openGroup = async () => { w.showSubGroups(group, CAT); await wait(60); };
    const tapTile = async re => { const t = tiles().find(x => re.test((x.querySelector('.tile-name') || {}).textContent || '')); if (!t) return false; tap(t); await wait(120); return true; };
    const host = () => doc.getElementById('sqCardHost');
    const route = () => w.S && w.S._lastRoute;
    // what the customer sees: every question on the card, its answer if chosen, its options
    const shown = () => [...(host() ? host().querySelectorAll('.intake-module-step') : [])].filter(s => s.querySelector('.ims-label[data-mod]')).map(s => {
        const lab = s.querySelector('.ims-label'), chips = [...s.querySelectorAll('.ims-chip')];
        const sel = chips.find(c => c.classList.contains('sel'));
        return { mod: lab.dataset.mod, text: lab.textContent.replace(/\s+/g, ' ').trim(), answered: sel ? sel.dataset.label : null, options: chips.map(c => c.dataset.label) };
    });
    const unanswered = () => shown().filter(q => !q.answered).map(q => q.mod);
    const answer = async (mod, label) => { const c = [...(host() ? host().querySelectorAll('.ims-chip') : [])].find(x => x.dataset.mod === mod && x.dataset.label === label); if (!c) return false; tap(c); await wait(120); return true; };
    const entityId = () => route() && route().entity && route().entity.id;
    const cap = () => (route() && route().maxFollowupQuestions) || 3;
    const noticeText = () => { const n = host() && host().querySelector('.route-notice'); return n ? n.textContent.replace(/\s+/g, ' ').trim() : null; };

    check('the page starts with no error', errors.length === 0, { expected: 'none', got: errors.slice(0, 3) });

    // ===== 1. THE PICKER ============================================================================================================================================================
    await openGroup();
    const authored = (ra.symptom_tiles || []).map(t => t.label);
    check('1.1 the group opens on its symptoms: no Diagnose / Set up / Fix-Repair step in front of them', !tileNames().some(n => /diagnose|set up \/ config|fix \/ repair/i.test(n)) && tileNames().length > 0, { expected: 'symptom tiles first', got: brief(tileNames()) });
    check('1.2 the symptom tiles are the authored words, in the authored order (not a humanised id: "Wont power on")', authored.length >= 6 && brief(tileNames().slice(0, authored.length)) === brief(authored), { expected: brief(authored), got: brief(tileNames()) });
    check('1.3 no tile reads like an identifier or has lost its apostrophe ("sym.", underscores, "Wont", "Laggy")', tileNames().some(n => /turn on/i.test(n)) && !tileNames().some(n => /sym\.|comp\.|_|\bWont\b|\bLaggy\b|\bMalware\b$/.test(n)), { expected: 'plain words', got: brief(tileNames()) });
    const lane = ra.known_need_tiles || [];
    check('1.4 "I know what I need" sits beside the symptoms: a prompt and a tile for each service a customer who knows what they need would ask for, each a real service of this group', lane.length >= 3 && lane.every(t => (group.explicit_services || []).includes(t.service_id)) && /know what you need/i.test((doc.getElementById('serviceContainer') || {}).textContent || '') && lane.every(t => tileNames().includes(t.label)), { expected: '>= 3 lane tiles, prompt shown', got: brief({ lane: lane.length, names: tileNames() }) });
    check('1.5 "Something else" is the last tile', /^something else$/i.test(tileNames().slice(-1)[0] || ''), { expected: 'Something else last', got: tileNames().slice(-1)[0] });
    check('1.6 the picker and the archetype agree (R-SYSTEM-PICKER-AGREE): every authored tile is a real symptom of the group and every real symptom has a tile', brief((ra.symptom_tiles || []).map(t => t.id).sort()) === brief((ra.real_symptom_ids || []).slice().sort()) && (ra.real_symptom_ids || []).length >= 6, { expected: 'same ids', got: brief({ tiles: (ra.symptom_tiles || []).map(t => t.id), real: ra.real_symptom_ids }) });

    // ===== 2. NO RE-ASK: every symptom tile ========================================================================================================================================
    const reasked = [], unreached = [], tooMany = [];
    for (const t of ra.symptom_tiles || []) {
        await openGroup();
        if (!(await tapTile(new RegExp('^' + t.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$')))) { unreached.push(t.label); continue; }
        const r = route(); if (!r) { unreached.push(t.label); continue; }
        const q = shown(), ans = r.answers || {};
        const tagAnswers = [].concat(...(t.tags || []).map(id => Object.entries(((DB.smart_tags || {})[id] || {}).answers || {})));
        for (const [mod, label] of tagAnswers) {
            if (!q.some(x => x.mod === mod)) continue;                                  // the module is not on this card: nothing to re-ask
            const s = q.find(x => x.mod === mod);
            if (ans[mod] !== label || s.answered !== label) reasked.push(`${t.label}: ${mod} shown as "${s.answered || 'unanswered'}", the tile says "${label}"`);
        }
        if (!tagAnswers.length && (t.tags || []).length) reasked.push(`${t.label}: its tags carry no answer at all`);
        if (unanswered().length > cap()) tooMany.push(`${t.label}: ${unanswered().length} unanswered > ${cap()}`);
        if (!(t.tags || []).length) reasked.push(`${t.label}: the tile carries no tag, so nothing it says reaches the card`);
    }
    check('2.1 every symptom tile opens a card (none dead)', (ra.symptom_tiles || []).length >= 6 && unreached.length === 0, { expected: 'all reach a card', got: brief(unreached) });
    check('2.2 what a tile says is on the card as an answer, and the question it answers is not asked again', (ra.symptom_tiles || []).length >= 6 && reasked.length === 0, { expected: 'none', got: reasked.slice(0, 5) });
    check('2.3 no tile opens more unanswered questions than the service allows at once', (ra.symptom_tiles || []).length >= 6 && tooMany.length === 0, { expected: 'none', got: tooMany.slice(0, 5) });

    // ===== 4. TARGETED: Won't turn on =================================================================================================================================================
    const L = { signs: 'laptop_power_signs', charger: 'laptop_charger_check' }, D = { signs: 'desktop_power_signs', outlet: 'desktop_outlet_check' };
    const wontOn = /^won'?t turn on$/i;
    const LAPTOP = 'Laptop', DESKTOP = 'Desktop (tower)', AIO = 'All-in-one';
    const lBattery = labelOf(L.signs, /shuts? off as soon as i unplug/i), lNothing = labelOf(L.signs, /^nothing at all/i), lBlack = labelOf(L.signs, /screen stays black/i);
    const lDamaged = labelOf(L.charger, /frayed, bent or burnt/i), lFine = labelOf(L.charger, /looks fine/i);
    const dNothing = labelOf(D.signs, /^nothing at all/i), dBlack = labelOf(D.signs, /screen stays black/i), dBurn = labelOf(D.signs, /pop|spark|burning/i);
    const dStill = labelOf(D.outlet, /still nothing/i), dCant = labelOf(D.outlet, /can't try/i);

    await openGroup(); await tapTile(wontOn);
    check('4.1 "Won\'t turn on": the card asks the computer type and nothing else (the symptom is the tile, not a question)', brief(unanswered()) === brief(['device_type']) && entityId() === HOST, { expected: '["device_type"] on ' + HOST, got: brief({ unanswered: unanswered(), entity: entityId() }) });
    check('4.1b the question the tile answered is on the card as answered, with the tile\'s own words', !!route() && !shown().some(q => q.mod === 'computer_symptom' && !q.answered), { expected: 'computer_symptom answered or absent', got: brief(shown().map(q => [q.mod, q.answered])) });

    await answer('device_type', LAPTOP);
    check('4.2 Laptop: exactly the laptop question, none of the desktop ones', brief(unanswered()) === brief([L.signs]) && !shown().some(q => /^desktop_/.test(q.mod)), { expected: brief([L.signs]), got: brief(unanswered()) });
    const qs = shown().find(q => q.mod === L.signs);
    check('4.3 the laptop question is one observable thing (what happens with the charger in), in words a customer can answer without a tool', !!qs && qs.options.length >= 3 && qs.options.every(o => !/\b(volt|ohm|multimeter|motherboard|vrm|rail|bios|post)\b/i.test(o)), { expected: '>= 3 plain options', got: brief(qs) });

    if (lBattery) {
        await answer(L.signs, lBattery);
        const r = route();
        check('4.4 "only works while the charger is in" routes to the battery: the part-replacement service, component Battery, computer Laptop, and the only question left is the part', entityId() === PARTS && r.answers.computer_component === 'Battery' && r.answers.device_type === LAPTOP && brief(unanswered()) === brief(['customer_supplied_part']), { expected: PARTS + ' / Battery / Laptop / [customer_supplied_part]', got: brief({ entity: entityId(), answers: r && r.answers, unanswered: unanswered() }) });
        const why = (routeOf(L.signs, lBattery) || {}).because || '';
        check('4.5 the customer is told what we concluded and why, in the same breath as the price, and is offered the way back', !!why && (noticeText() || '').includes(why) && !!(host() && host().querySelector('.route-undo')), { expected: 'notice with the because-sentence and an undo button', got: noticeText() });
        const undo = host() && host().querySelector('.route-undo'); if (undo) { tap(undo); await wait(120); }
        check('4.6 "Not right? Change my answer" takes it back: the diagnostic card, the laptop question unanswered again, and nothing else lost', entityId() === HOST && brief(unanswered()) === brief([L.signs]) && route().answers.device_type === LAPTOP, { expected: HOST + ' / [' + L.signs + ']', got: brief({ entity: entityId(), unanswered: unanswered() }) });
    } else check('4.4 the battery observation exists in the laptop question', false, { expected: 'an option naming the unplug case', got: brief((mods[L.signs] || {}).client_response) });

    if (lNothing && lDamaged) {
        await openGroup(); await tapTile(wontOn); await answer('device_type', LAPTOP); await answer(L.signs, lNothing);
        check('4.7 "nothing at all" opens ONE more question, about the charger -- the next most likely part and a thing the customer can look at', brief(unanswered()) === brief([L.charger]), { expected: brief([L.charger]), got: brief(unanswered()) });
        await answer(L.charger, lDamaged);
        check('4.8 a damaged charger routes to the charger (component), not to the diagnostic', entityId() === PARTS && /charger/i.test(route().answers.computer_component || ''), { expected: PARTS + ' / charger', got: brief({ entity: entityId(), c: route() && route().answers.computer_component }) });
        await openGroup(); await tapTile(wontOn); await answer('device_type', LAPTOP); await answer(L.signs, lNothing); await answer(L.charger, lFine);
        check('4.9 a charger that looks fine does NOT retire the uncertainty: the diagnostic stays, after exactly three answered questions (computer type, signs, charger), nothing left to ask', entityId() === HOST && unanswered().length === 0 && shown().filter(q => q.answered).length <= 4, { expected: HOST + ', no open question', got: brief({ entity: entityId(), unanswered: unanswered(), answered: shown().filter(q => q.answered).map(q => q.mod) }) });
    } else check('4.7 the laptop charger question exists', false, { expected: 'laptop_charger_check with a damaged-charger and a looks-fine option', got: brief((mods[L.charger] || {}).client_response) });
    if (lBlack) {
        await openGroup(); await tapTile(wontOn); await answer('device_type', LAPTOP); await answer(L.signs, lBlack);
        check('4.10 lights or a fan but a black screen is board / memory / screen territory: it stays on the diagnostic with no further question (it cannot be retired from a chair)', entityId() === HOST && unanswered().length === 0, { expected: HOST + ', nothing open', got: brief({ entity: entityId(), unanswered: unanswered() }) });
    }

    await openGroup(); await tapTile(wontOn); await answer('device_type', DESKTOP);
    check('4.11 Desktop: exactly the desktop question, none of the laptop ones', brief(unanswered()) === brief([D.signs]) && !shown().some(q => /^laptop_/.test(q.mod)), { expected: brief([D.signs]), got: brief(unanswered()) });
    if (dNothing && dStill) {
        await answer(D.signs, dNothing);
        check('4.12 "nothing at all" on a desktop asks the one thing that rules out the wall: another outlet and cord', brief(unanswered()) === brief([D.outlet]), { expected: brief([D.outlet]), got: brief(unanswered()) });
        await answer(D.outlet, dStill);
        check('4.13 still dead after another outlet and cord routes to the power supply (component), computer Desktop', entityId() === PARTS && /power supply/i.test(route().answers.computer_component || '') && route().answers.device_type === DESKTOP, { expected: PARTS + ' / power supply / Desktop', got: brief({ entity: entityId(), a: route() && route().answers }) });
        await openGroup(); await tapTile(wontOn); await answer('device_type', DESKTOP); await answer(D.signs, dNothing); await answer(D.outlet, dCant);
        check('4.14 "I can\'t try that right now" does not pretend to know: it stays on the diagnostic', entityId() === HOST && unanswered().length === 0, { expected: HOST, got: brief({ entity: entityId(), unanswered: unanswered() }) });
    } else check('4.12 the desktop questions exist', false, { expected: 'desktop_power_signs / desktop_outlet_check', got: brief({ s: (mods[D.signs] || {}).client_response, o: (mods[D.outlet] || {}).client_response }) });
    if (dBurn) {
        await openGroup(); await tapTile(wontOn); await answer('device_type', DESKTOP); await answer(D.signs, dBurn);
        check('4.15 a pop, a spark or a burning smell is the power supply, at once (two questions)', entityId() === PARTS && /power supply/i.test(route().answers.computer_component || ''), { expected: PARTS + ' / power supply', got: brief({ entity: entityId() }) });
    }
    await openGroup(); await tapTile(wontOn); await answer('device_type', AIO);
    check('4.16 All-in-one: the power question for a tower or a laptop does not apply, so none is asked, and the diagnostic is honest about it', entityId() === HOST && unanswered().length === 0, { expected: HOST + ', nothing open', got: brief({ entity: entityId(), unanswered: unanswered() }) });

    // ===== 4b. the other symptoms ======================================================================================================================================================
    const tileFor = id => (ra.symptom_tiles || []).find(t => t.id === id);
    const openTile = async id => { await openGroup(); const t = tileFor(id); return t ? tapTile(new RegExp('^' + t.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$')) : false; };
    const viaTile = async (id, steps) => { if (!(await openTile(id))) return null; for (const [m, l] of steps) if (l) await answer(m, l); return { entity: entityId(), answers: (route() || {}).answers || {}, open: unanswered() }; };
    {
        const dev = LAPTOP;
        const r1 = await viaTile('sym.slow_laggy', [['device_type', DESKTOP]]);
        check('4.17 "Slow or freezing": the computer type and one targeted question -- not the nine-answer symptom list', !!r1 && brief(r1.open) === brief(['slow_pattern']), { expected: '["slow_pattern"]', got: brief(r1) });
        const sp = (mods.slow_pattern || {}).client_response || [];
        const goes = re => { const o = sp.find(x => re.test(x.label)); return o && o.route_to && o.route_to.service; };
        check('4.18 slow + pop-ups goes to the virus cleanup; slow + minutes to start (an old machine) to the drive; slow with many tabs to memory', goes(/pop-ups/i) === 'virus_or_malware_removal' && goes(/minutes to start/i) === PARTS && goes(/many tabs|many programs/i) === PARTS, { expected: 'virus / parts / parts', got: brief(sp.map(o => [o.label, o.route_to && o.route_to.service])) });
        const r2 = await viaTile('sym.overheating', [['device_type', dev]]);
        check('4.19 "Gets hot, or the fan is loud": one targeted question after the computer type', !!r2 && brief(r2.open) === brief(['heat_signs']), { expected: '["heat_signs"]', got: brief(r2) });
        const r3 = await viaTile('sym.battery', []);
        check('4.20 "Battery drains fast or won\'t charge": the computer is a laptop (a battery says so), so only the battery question is open', !!r3 && r3.answers.device_type === LAPTOP && brief(r3.open) === brief(['battery_signs']), { expected: 'Laptop; ["battery_signs"]', got: brief(r3) });
        const r4 = await viaTile('sym.wont_start_up', [['device_type', DESKTOP]]);
        check('4.21 "Turns on, but won\'t start up": one question about what the screen shows', !!r4 && brief(r4.open) === brief(['startup_screen']), { expected: '["startup_screen"]', got: brief(r4) });
        const r5 = await viaTile('sym.virus_malware', []);
        check('4.22 "Pop-ups or a possible virus": the virus service, and nothing to answer (the tile said it)', !!r5 && r5.entity === 'virus_or_malware_removal' && r5.open.length === 0, { expected: 'virus_or_malware_removal, no open question', got: brief(r5) });
        const r6 = await viaTile('sym.lost_files', []);
        check('4.23 "Lost or deleted files": the backup/recovery service with its "what is the situation" question already answered; only the device the files are on is asked', !!r6 && r6.entity === 'data_backup_or_transfer' && brief(r6.open) === brief(['backup_source_device']) && /lost|corrupt/i.test(r6.answers.tech_issue_source || ''), { expected: 'data_backup_or_transfer, [backup_source_device], situation = lost files', got: brief(r6) });
    }

    // ===== 3. NO RE-ASK: typed phrases ================================================================================================================================================
    const typed = async (text) => {
        const c = w.collectBookingContext_freeText(text);
        const r = w.executeWorkflow(Object.assign({}, c, { tagsAffirmed: true }), w.DB);
        const open = (r.visibleChain || []).filter(m => !r.answers[m.moduleKey || m.module]).map(m => m.moduleKey || m.module);
        return { entity: r.entity && r.entity.id, answers: r.answers, open, tags: r.activeTags };
    };
    {
        const a = await typed("my laptop won't turn on");
        check('3.1 "my laptop won\'t turn on": the computer type and the symptom were typed, so neither is asked; the laptop question is', a.entity === HOST && a.answers.device_type === LAPTOP && !!a.answers.computer_symptom && brief(a.open) === brief([L.signs]), { expected: HOST + ' / Laptop / symptom answered / [' + L.signs + ']', got: brief(a) });
        const b = await typed('my desktop wont power on');
        check('3.2 "my desktop wont power on": the desktop question only', b.entity === HOST && b.answers.device_type === DESKTOP && brief(b.open) === brief([D.signs]), { expected: HOST + ' / Desktop / [' + D.signs + ']', got: brief(b) });
        const c = await typed("my computer won't turn on");
        check('3.3 "my computer won\'t turn on": we cannot know which, so the computer type is the one question', c.entity === HOST && !!c.answers.computer_symptom && brief(c.open) === brief(['device_type']), { expected: HOST + ' / symptom answered / ["device_type"]', got: brief(c) });
        const d = await typed('my computer is slow');
        check('3.4 "my computer is slow" is a slow computer, not a virus: it no longer carries the virus answer (and the virus price)', d.entity !== 'virus_or_malware_removal' && d.answers.tech_problem_type !== 'Virus or pop-ups' && !(d.tags || []).includes('#virus'), { expected: 'no #virus', got: brief(d) });
        const e = await typed('I need more RAM');
        check('3.5 "I need more RAM": the part was typed, so "which part?" is not asked', e.entity === PARTS && /ram/i.test(e.answers.computer_component || '') && !e.open.includes('computer_component'), { expected: PARTS + ' / RAM answered', got: brief(e) });
        const f = await typed('replace my laptop battery');
        check('3.6 "replace my laptop battery": part and computer typed, so only whether we source the part is asked', f.entity === PARTS && f.answers.computer_component === 'Battery' && f.answers.device_type === LAPTOP && brief(f.open) === brief(['customer_supplied_part']), { expected: PARTS + ' / Battery / Laptop / [customer_supplied_part]', got: brief(f) });
        const g = await typed('pop ups on my computer');
        check('3.7 "pop ups on my computer" still reaches the virus service with the answer typed', g.entity === 'virus_or_malware_removal' && g.answers.tech_problem_type === 'Virus or pop-ups' && g.open.length === 0, { expected: 'virus_or_malware_removal, nothing open', got: brief(g) });
        // A part the customer names with a computer word beside it ("for my desktop") is still a part: the computer is the stronger object, so the service's own description decides the sibling.
        const h = await typed('new power supply for my desktop');
        check('3.8 "new power supply for my desktop": the part service, with the part and the computer typed -- not the $231 diagnostic of a customer who does not know what is wrong', h.entity === PARTS && /power supply/i.test(h.answers.computer_component || '') && h.answers.device_type === DESKTOP && brief(h.open) === brief(['customer_supplied_part']), { expected: PARTS + ' / Power supply / Desktop / [customer_supplied_part]', got: brief(h) });
        const i = await typed('my psu is dead');
        check('3.9 "my psu is dead": the word for the part reaches the part service (it matched nothing and fell to a wall-mounting question)', i.entity === PARTS && /power supply/i.test(i.answers.computer_component || ''), { expected: PARTS + ' / Power supply', got: brief(i) });
        // ...and the same words wording a SYMPTOM stay with the diagnostic: "the fan is loud" is not a request for a fan.
        const j = await typed('my laptop fan is loud');
        check('3.10 "my laptop fan is loud" is a symptom, not a request for a fan: the diagnostic, the laptop and the symptom taken from the words, and the one heat question that separates a noisy fan from a hot machine (it was judged in the ceiling-fan group of another category, which dropped both)', j.entity === HOST && j.answers.device_type === LAPTOP && !!j.answers.computer_symptom && brief(j.open) === brief(['heat_signs']), { expected: HOST + ' / Laptop / symptom answered / [heat_signs]', got: brief(j) });
        const k = await typed('I lost my files');
        check('3.11 "I lost my files": the backup and recovery service with its situation question answered; only where the files are is asked', k.entity === 'data_backup_or_transfer' && /lost|corrupt/i.test(k.answers.tech_issue_source || '') && brief(k.open) === brief(['backup_source_device']), { expected: 'data_backup_or_transfer / situation answered / [backup_source_device]', got: brief(k) });
        const l = await typed('my macbook is slow');
        check('3.12 "my macbook is slow": a MacBook is a laptop, and the sentence says it is slow, so neither is asked', l.entity === HOST && l.answers.device_type === LAPTOP && !!l.answers.computer_symptom && !l.open.includes('device_type') && !l.open.includes('computer_symptom'), { expected: HOST + ' / Laptop / symptom answered', got: brief(l) });
        // The engine rule that makes 3.11 and 3.12 true, stated where it is general: a tag scoped to a group is judged against the group of the named service the words reached, when the keyword resolver
        // names no group. "cinder block" names no group the resolver knows, but it reached the brick-and-concrete repair service, and brick is that group's own fact.
        const m = await typed('cinder block');
        check('3.13 a tag scoped to a group is valid for a sentence that reached a service in that group, even when the keyword resolver named no group ("cinder block" -> brick)', m.entity === 'brick_or_concrete_crack_repair' && (m.tags || []).includes('#brick_wall'), { expected: 'brick_or_concrete_crack_repair with #brick_wall', got: brief(m) });
        // The part tags are scoped to this group (applicable_group_ids), so they are chips only in Computer Repair's builder, and a router's "power supply" does not carry a PC part answer into the router service.
        const n = await typed('replace the power supply on my router');
        check('3.14 the part tags are scoped to Computer Repair: "replace the power supply on my router" carries no computer part, and the six tags are valid in no other Tech Trouble group', !n.answers.computer_component && ['#ram_upgrade', '#ssd_upgrade', '#new_battery', '#new_charger', '#power_supply', '#new_fan'].every(tg => w.tagValidForCategory(tg, CAT, GROUP) && ['tech_trouble_networking', 'tech_trouble_smart_home', 'tech_trouble_cable_management'].every(gid => !w.tagValidForCategory(tg, CAT, gid))), { expected: 'no computer_component on the router; valid only in ' + GROUP, got: brief(n) });
        const o = await typed('replace the fan in my computer');
        check('3.15 "replace the fan in my computer": the word "fan" sends the keyword resolver to the ceiling-fan group of another category; the part is still taken from the words', o.entity === PARTS && o.answers.computer_component === 'Fan', { expected: PARTS + ' / Fan', got: brief(o) });
    }

    // ===== 5. THE DIAGNOSTIC IS THE LAST RESORT: walk every answer of every symptom ===================================================================================================
    {
        const leaves = {}, longest = { n: 0, at: '' };
        // breadth-first over the real engine (not the DOM): at each state the first open routing question is expanded over all its options
        const reach = (tile, device) => {
            const out = new Set(), seen = new Set();
            const start = (() => { const svcId = (ra.symptom_id_to_service_ids[tile.id] || [])[0]; const s = DB.services.find(x => x.id === svcId); const c = w.collectBookingContext_catalog(s, CAT); c.manuallyToggledTagIds = tile.tags || []; c.answers = device ? { device_type: device } : {}; return c; })();
            const go = (ctx, n) => {
                const key = JSON.stringify([ctx.selectedServiceId, ctx.answers]); if (seen.has(key)) return; seen.add(key);
                const r = w.executeWorkflow(ctx, w.DB);
                const open = (r.visibleChain || []).filter(m => !r.answers[m.moduleKey || m.module] && ((m.purpose || '') === 'routing'));
                if (!open.length) { out.add(r.entity.id + ' @' + n); longest.n = Math.max(longest.n, n); if (n > longest.n - 1) longest.at = tile.id + '/' + device; return; }
                const m = open[0];
                for (const o of m.client_response || []) go(Object.assign({}, r.context, { answers: Object.assign({}, r.context.answers, { [m.moduleKey || m.module]: o.label }) }), n + 1);
            };
            go(start, 0);
            return [...out];
        };
        const hardware = (ra.symptom_tiles || []).filter(t => !/virus|lost_files/.test(t.id));
        const noDefinitive = [], tooLong = [];
        for (const t of hardware) for (const dev of [LAPTOP, DESKTOP]) {
            if (t.id === 'sym.battery' && dev !== LAPTOP) continue;   // a tower has no battery to drain: the tile itself says Laptop (4.20), so that pair is not a situation a customer can be in
            const lv = reach(t, dev);
            const kinds = new Set(lv.map(x => x.split(' @')[0]));
            if (![...kinds].some(k => k !== HOST)) noDefinitive.push(`${t.id}/${dev}: only ${[...kinds].join(',') || 'nothing'}`);
            if (lv.some(x => Number(x.split('@')[1]) > 2)) tooLong.push(`${t.id}/${dev}: ${lv.filter(x => Number(x.split('@')[1]) > 2).join(',')}`);
        }
        check('5.1 for every hardware symptom and each of Laptop and Desktop, at least one answer reaches a definitive part or service, not the diagnostic', hardware.length >= 5 && noDefinitive.length === 0, { expected: 'a definitive leaf for each', got: noDefinitive.slice(0, 6) });
        check('5.2 no path asks more than two targeted questions after the computer type (three with it: the cap)', hardware.length >= 5 && tooLong.length === 0, { expected: 'none', got: tooLong.slice(0, 6) });
    }

    // ===== 6. THE CART ================================================================================================================================================================
    {
        await openGroup(); await tapTile(wontOn); await answer('device_type', LAPTOP);
        if (lBattery) {
            await answer(L.signs, lBattery);
            const part = labelOf('customer_supplied_part', /^yes/i); if (part) await answer('customer_supplied_part', part);
            const add = host() && host().querySelector('#btn-curated-add'); if (add) { tap(add); await wait(120); }
            const cart = (w.__store && w.__store.getState().cart.serviceRequest) || [];
            const line = cart[cart.length - 1] || {};
            check('6.1 the request is booked as the part replacement, carrying the answers that led there', line.serviceId === PARTS && line.intakeAnswers && line.intakeAnswers.computer_component === 'Battery' && line.intakeAnswers.device_type === LAPTOP, { expected: PARTS + ' with component Battery and device Laptop', got: brief(line) });
            check('6.2 and under the name a customer would look for (not "Internal Hardware Replacement")', /part/i.test(line.name || '') && !/internal hardware/i.test(line.name || ''), { expected: 'a "Part ..." name', got: line.name });
        } else check('6.1 the request is booked as the part replacement', false, { expected: 'a battery route', got: 'no battery observation authored' });
    }

    check('the page logged no error while driven', errors.length === 0, { expected: 'none', got: errors.slice(0, 3) });
    finish();
    process.exit(0);
})().catch(e => { check('ran to completion', false, { expected: 'no throw', got: String(e && e.stack || e).split('\n').slice(0, 3).join(' | ') }); finish(); process.exit(1); });
