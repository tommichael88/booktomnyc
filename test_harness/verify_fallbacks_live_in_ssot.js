#!/usr/bin/env node
/**
 * verify_fallbacks_live_in_ssot.js -- the class detector for "a business number the SSOT does not own".
 *
 * @enforces R-SYSTEM-NODATA
 * @enforces R-INVARIANT-SINGLEDEF
 *
 * THE CLASS (R-SYSTEM-NODATA): "No business rule in code that should be in data. If a change to pricing, services, or fees requires touching application code, that is a signal the
 * SSOT is incomplete." The code used to keep nine such numbers and phrases in a frozen object, FALLBACKS, whose own comment called them "the last remaining hardcoded business numbers
 * the SSOT does not yet own". They now live in btnyc.json at global_rules.fallbacks (the reasoning for each in the block's `_notes`), the schema requires them, and FALLBACKS is a
 * read-only view of that block that holds no value of its own. This test holds the class, not the nine values: it names no number (a recalibrated fallback must not turn it red) and
 * it reads no source text for a value. It asserts five things.
 *
 *   1. AGREEMENT      The SSOT block, the schema's declaration of it, and the code's read sites (`FALLBACKS.<name>`, found in the page's syntax tree) name the same keys: no read of a key
 *                     the SSOT lacks (a typo would only fail at the call), no key nobody reads (a dead number), no computed read that cannot be checked.
 *   2. NO COPY        Boot the real page, put a sentinel into each key of the live DB, and read it back through FALLBACKS: the code returns what the SSOT holds, for every key. A key with
 *                     the SSOT value removed does not fall back to anything -- it throws, naming the key -- so a default carried in code cannot hide behind a missing field.
 *   3. THE GUARD      Reading before the SSOT is loaded throws (it never yields `undefined` into a price); a document without the block throws, naming the path; a key nobody
 *                     defined throws; FALLBACKS cannot be written, deleted or redefined; enumerating it reports the SSOT's keys and not an empty object.
 *   4. BOOT ORDER     (the operator's Note B) On a real jsdom boot, a spy on the page's own Proxy constructor counts every read of FALLBACKS made before `DB` is set, and the count is
 *                     asserted ZERO. The spy is shown able to see one: a mutant page that reads FALLBACKS just before `DB = SERVICE_DATA` is counted, and the guard turns that read into a
 *                     boot failure (DB never set) instead of a quiet `undefined`. Reads after DB is set are counted and printed so the zero is not read as "never read at all".
 *   5. THE SCHEMA     The real boot gate (the page's own `orch_validate_ssot`) accepts the SSOT as it is and refuses a copy missing the block, missing any one key, holding any one key
 *                     as the wrong type, or holding a key the schema does not declare -- each of them for EVERY key. The real page, given an SSOT without the block, does not boot.
 *   6. THE TAIL       (the same class, wider) A numeric literal as the last operand of a `??` / `||` chain is a business number defaulted in code. 0 and 1 (identity elements) are exempt;
 *                     strings and non-defaulting arithmetic are out of scope here. Every such default in every layer is held in FILED below with its class and the ledger entry that
 *                     names it. A NEW one is red (put the number in the SSOT, or file it); a filed one that no longer exists is red too (delete it from FILED: the list only shrinks).
 *                     The scanner is shown on synthetic source so the detector cannot pass by finding nothing.
 *
 * WHAT THIS DOES NOT COVER (named, so it is not mistaken for more): string defaults (`|| 'skilled'`), numbers that are not the last operand of a default chain (a ternary, an
 * assignment), and constants tables other than FALLBACKS. They are the same disease in other shapes; widening the scan to them is a decision for the ledger (PENDING_DECISIONS #144).
 *
 * RUN ON ANOTHER TREE (G-INVARIANT-PREFIX; this file is run against the tree as it was BEFORE the fix, and must fail there):
 *     BTNYC_QR_FILE=<tree>/qr.html BTNYC_PAGE_ROOT=<tree> node test_harness/verify_fallbacks_live_in_ssot.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const Q = require('./_qr_blocks.js');
const L = require('./_layers.js');
const Page = require('./_page.js');

const REPO_ROOT = process.env.BTNYC_PAGE_ROOT ? path.resolve(process.env.BTNYC_PAGE_ROOT) : path.join(__dirname, '..');
const html = Page.readPage();
const readJson = rel => JSON.parse(fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8'));
const SSOT = readJson('btnyc.json');
const SCHEMA = readJson('schema/btnyc_schema.json');
const LEDGER = fs.readFileSync(path.join(REPO_ROOT, 'PENDING_DECISIONS.md'), 'utf8');

let pass = 0, fail = 0;
const check = (label, ok, detail) => {
    if (ok) { pass++; console.log(`  ✓ ${label}`); }
    else { fail++; console.log(`  ✗ ${label}`); if (detail) console.log(`      ${detail}`); }
};
// A section that throws is a red check naming the exception, never a crash that hides every later section (the pre-fix tree has no block to read).
const section = async (title, fn) => {
    console.log(`\n=== ${title} ===`);
    try { await fn(); } catch (e) { check(`${title}: ran to completion`, false, String(e && e.stack || e).split('\n').slice(0, 3).join(' | ')); }
};
const clone = o => JSON.parse(JSON.stringify(o));
const isAnnotation = k => k.startsWith('_');
const valueKeys = block => Object.keys(block || {}).filter(k => !isAnnotation(k));

const BLOCK = SSOT.global_rules && SSOT.global_rules.fallbacks;
const KEYS = valueKeys(BLOCK);

// ---- the page, booted for real ---------------------------------------------------------------------------------------------------------------------------------------
async function boot({ data = SSOT, schema = SCHEMA, mutateHtml, spy } = {}) {
    const log = { proxies: [], reads: [] };
    const dom = new JSDOM(mutateHtml ? mutateHtml(html) : html, {
        url: 'https://tommichael88.github.io/booktomnyc/qr.html',
        runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true,
        beforeParse(w) {
            const ok = body => ({ ok: true, status: 200, json: async () => clone(body) });
            w.fetch = async u => {
                const s = String(u);
                if (s.includes('btnyc_schema.json')) return ok(schema);
                if (s.includes('btnyc.json')) return ok(data);
                return { ok: false, status: 404 };
            };
            w.HTMLElement.prototype.scrollIntoView = function () {};
            if (spy) {
                // The page builds FALLBACKS with `new Proxy(...)`. Replace the constructor the page will resolve, so every Proxy it makes reports its string-keyed reads and whether
                // window.DB was set at that moment. The page's own handler still runs; nothing about FALLBACKS is stubbed.
                const RealProxy = w.Proxy;
                w.Proxy = new RealProxy(RealProxy, {
                    construct(Target, args) {
                        const handler = args[1] || {};
                        const spied = Object.assign({}, handler);
                        if (typeof handler.get === 'function') {
                            spied.get = function (t, k, receiver) {
                                if (typeof k === 'string') log.reads.push({ key: k, dbSet: !!w.DB, proxy: log.proxies.indexOf(receiver) });
                                return handler.get.apply(this, arguments);
                            };
                        }
                        const p = new Target(args[0], spied);
                        log.proxies.push(p);
                        return p;
                    },
                });
            }
        },
    });
    const w = dom.window;
    for (let i = 0; i < 120 && !(w.DB && w.DB.services && w.document.getElementById('sqDescIn')); i++) await new Promise(r => setTimeout(r, 100));
    await new Promise(r => setTimeout(r, 300));
    return { w, log };
}
const probe = (w, expr) => { try { return { threw: false, value: w.eval(expr) }; } catch (e) { return { threw: true, message: String(e && e.message) }; } };

// ---- the tail scanner (section 6) ---------------------------------------------------------------------------------------------------------------------------------------
// Numeric literals that end a `??` / `||` chain, excluding the identity elements 0 and 1. Returns [{ op, value }] for one function body.
function numericDefaultsIn(fnNode) {
    const found = [];
    Q.walkAst(fnNode, (n, parent) => {
        if (n.type !== 'LogicalExpression' || (n.operator !== '??' && n.operator !== '||')) return;
        if (parent && parent.type === 'LogicalExpression' && parent.operator === n.operator) return;   // report a chain once, from its root
        const operands = [];
        (function flat(e) { if (e.type === 'LogicalExpression' && e.operator === n.operator) { flat(e.left); flat(e.right); } else operands.push(e); })(n);
        for (const o of operands.slice(1)) if (o.type === 'Literal' && typeof o.value === 'number' && o.value !== 0 && o.value !== 1) found.push({ op: n.operator, value: o.value });
    });
    return found;
}
const scanPage = pageHtml => {
    const { units, errors } = L.unitsOfHtml(pageHtml, L.loadLayerMap());
    const tally = {};
    for (const u of units) for (const d of numericDefaultsIn(u.fnNode)) { const k = `${u.layer} ${u.owner} ${d.op} ${d.value}`; tally[k] = (tally[k] || 0) + 1; }
    return { tally, errors, units: units.length };
};

// Every numeric default in the code that is not a FALLBACKS key, as the tree stands after C (T160). `[count, ledger entry, what it is]`.
//   ssot-has-it : the SSOT already holds this exact number under the key the code reads; the literal is a second, redundant copy used only if the SSOT omits the field.
//   conflict    : one concept ("how long is a job with no authored estimate") answered 30 / 45 / 60 in different places (#143).
//   no-home     : a number with no SSOT key at all (a parse default, a sort sentinel, a display fallback).
const FILED = {
    'logic applyLiveConfidenceEscalation ?? 95': [1, 144, 'ssot-has-it: confidence_escalation.max_minimum_quote_confidence'],
    'logic applyLiveConfidenceEscalation ?? 6': [1, 144, 'ssot-has-it: confidence_escalation.max_followup_questions_absolute'],
    'logic applyPricingFormula || 5': [2, 144, 'ssot-has-it: pricing_formulas.*.minutes_per_tile / minutes_per_sqft'],
    'logic applyPricingFormula || 2': [1, 144, 'no-home: the square-foot count assumed when the customer typed none'],
    'logic applyPricingFormula ?? 3': [1, 144, 'ssot-has-it: pricing_formulas.*.minimum_hours_for_start_fee_waiver'],
    'logic computeArchetypeQuote || 30': [3, 143, 'conflict: minutes of a job with no expected_minutes (30 here, 45 in computeUnifiedQuote, 60 in the Buy-the-Hour floor)'],
    'logic detectIntentNLP || 30': [2, 144, 'no-home: confidence_weight assumed for a keyword entry that authors none'],
    'logic detectIntentNLP ?? 50': [1, 144, 'ssot-has-it: thresholds.route_to_group_other_tile'],
    'logic collectBookingContext_freeText || 70': [1, 144, 'ssot-has-it: thresholds.auto_select_named_service'],
    'rendering _renderSimpleConfirm || 45': [1, 143, 'conflict: minutes written onto a cart line when the service authors none'],
    'rendering _renderStructuredIntake || 60': [1, 143, 'conflict: minutes written onto a cart line when the service authors none'],
    'rendering renderServices ?? 999': [2, 144, 'no-home: sort position of a service with no sort_order (last)'],
    'glue addToCart ?? 2': [1, 144, 'no-home: the quantity shown in a toast when the cart returns none'],
};

// ===========================================================================================================================================================================
(async () => {
    await section('1. agreement: SSOT block, schema and read sites name the same keys', async () => {
        check('btnyc.json has global_rules.fallbacks', !!BLOCK && typeof BLOCK === 'object');
        const declared = SCHEMA.properties.global_rules.properties && SCHEMA.properties.global_rules.properties.fallbacks;
        check('the schema declares global_rules.fallbacks and requires it of global_rules', !!declared && (SCHEMA.properties.global_rules.required || []).includes('fallbacks'));
        const declaredKeys = declared ? Object.keys(declared.properties || {}).filter(k => !isAnnotation(k)) : [];
        check('the schema declares exactly the keys the SSOT holds (no more, no fewer)', KEYS.length > 0 && JSON.stringify(declaredKeys.slice().sort()) === JSON.stringify(KEYS.slice().sort()),
            `schema: [${declaredKeys}]  ssot: [${KEYS}]`);
        check('the schema requires every value key and closes the object (additionalProperties: false)', !!declared && KEYS.every(k => (declared.required || []).includes(k)) && declared.additionalProperties === false);
        check('the schema types every value key as number or string (not left open)', !!declared && KEYS.every(k => declared.properties[k] && ['number', 'string'].includes(declared.properties[k].type)));
        const notes = BLOCK && BLOCK._notes;
        check('every value key carries its reasoning in _notes (R-SYSTEM-NODATA: the field\'s own _note), and _notes names no key that does not exist',
            !!notes && KEYS.every(k => typeof notes[k] === 'string' && notes[k].length > 40) && Object.keys(notes).every(k => KEYS.includes(k)),
            notes ? `undocumented: [${KEYS.filter(k => !(typeof notes[k] === 'string' && notes[k].length > 40))}] unknown: [${Object.keys(notes).filter(k => !KEYS.includes(k))}]` : 'no _notes');

        // read sites, from the syntax tree (comments and strings cannot match)
        const reads = new Map(), computed = [];
        let declarations = 0;
        for (const b of Q.splitScriptBlocks(html)) {
            if (!b.src.trim()) continue;
            const p = Q.tryParseJs(b.src, b.startLine);
            if (p.error) continue;
            Q.walkAst(p.ast, (n, parent) => {
                if (n.type === 'VariableDeclarator' && n.id.type === 'Identifier' && n.id.name === 'FALLBACKS') declarations++;
                if (n.type === 'MemberExpression' && n.object.type === 'Identifier' && n.object.name === 'FALLBACKS') {
                    if (n.computed && n.property.type !== 'Literal') computed.push(b.startLine + n.loc.start.line - 1);
                    else { const name = n.computed ? String(n.property.value) : n.property.name; reads.set(name, (reads.get(name) || 0) + 1); }
                }
            });
        }
        check('FALLBACKS is declared once (R-INVARIANT-SINGLEDEF)', declarations === 1, `${declarations} declarations`);
        check('no computed read of FALLBACKS (a read the check cannot name)', computed.length === 0, `at assembled-page lines ${computed}`);
        const unknownReads = [...reads.keys()].filter(k => !KEYS.includes(k));
        check('every key the code reads exists in the SSOT block', unknownReads.length === 0, `read but not in global_rules.fallbacks: [${unknownReads}]`);
        const deadKeys = KEYS.filter(k => !reads.has(k));
        check('every key in the SSOT block is read by the code (no dead number)', KEYS.length > 0 && deadKeys.length === 0, `held in global_rules.fallbacks but never read: [${deadKeys}]`);
        // The duplicates (PENDING_DECISIONS #142): fallbacks that repeat a number the catalog already holds. Copies, not links, until the operator rules which side owns each, so
        // the pair must stay equal -- a one-sided edit is red here instead of two authoritative numbers (R-INVARIANT-DUPLICATION-TICKET).
        const PAIRS = [
            ['base_price', 'service_types.Repair.base_price'],
            ['tier_rate', 'global_rules.complexity_tiers.skilled.hourly_rate'],
            ['dispatch_fee', 'global_rules.surcharges.dispatch_fee'],
            ['standard_labor', 'meta.global_rates.standard_labor'],
            ['badge_label', 'checkout_states.standard_flat_rate.ui_badge_label'],
        ];
        const at = (o, p) => p.split('.').reduce((a, k) => (a == null ? undefined : a[k]), o);
        const driftOf = (block, ssot) => PAIRS.filter(([k, p]) => block === undefined || block[k] === undefined || at(ssot, p) === undefined || block[k] !== at(ssot, p));
        const drifted = driftOf(BLOCK, SSOT);
        check('the five filed duplicates (#142) still equal the field they copy', BLOCK !== undefined && drifted.length === 0,
            drifted.map(([k, p]) => `${k}=${JSON.stringify(BLOCK && BLOCK[k])} vs ${p}=${JSON.stringify(at(SSOT, p))}`).join('; '));
        const skewed = clone(SSOT); skewed.global_rules.surcharges.dispatch_fee += 5; skewed.meta.global_rates.standard_labor += 5;
        check('MUTANT (one side of a duplicate edited alone) is caught: both skewed pairs are reported', BLOCK !== undefined && JSON.stringify(driftOf(BLOCK, skewed).map(d => d[0])) === JSON.stringify(['dispatch_fee', 'standard_labor']));
        console.log(`    (${KEYS.length} keys; ${[...reads.values()].reduce((a, b) => a + b, 0)} read sites: ${[...reads].map(([k, n]) => `${k}×${n}`).join(', ')})`);
    });

    // ---- one real boot with the spy installed serves sections 2, 3, 4 and 5 ----
    let main = null;
    await section('booting the real page (spy on the page\'s Proxy constructor)', async () => {
        main = await boot({ spy: true });
        const { w } = main;
        check('the page booted: DB is set and the text bar exists', !!(w.DB && w.DB.services && w.document.getElementById('sqDescIn')));
        check('the boot gate ran against the real schema and the SSOT is valid', w.__ssotValidation && w.__ssotValidation.status === 'valid',
            w.__ssotValidation ? `status ${w.__ssotValidation.status}: ${JSON.stringify((w.__ssotValidation.errors || []).slice(0, 2))}` : 'no verdict recorded');
    });

    // Reads made during boot, taken now, before any probe adds to the log.
    const bootReads = main ? main.log.reads.slice() : [];

    await section('2. no copy: FALLBACKS returns what the live DB holds, for every key', async () => {
        const { w } = main;
        const live = w.DB.global_rules.fallbacks;
        check('the live DB carries the block', !!live && KEYS.length > 0);
        let readThrough = KEYS.length > 0, why = KEYS.length ? '' : ' (the SSOT block has no keys to read)';
        for (const k of KEYS) {
            const had = live[k];
            live[k] = `§sentinel:${k}`;
            const r = probe(w, `FALLBACKS[${JSON.stringify(k)}]`);
            live[k] = had;
            if (r.threw || r.value !== `§sentinel:${k}`) { readThrough = false; why += ` ${k}=>${r.threw ? 'threw ' + r.message : JSON.stringify(r.value)};`; }
        }
        check('a sentinel written into each key of the live DB comes back through FALLBACKS (the code holds no value of its own)', readThrough, why);
        let noDefault = KEYS.length > 0; why = KEYS.length ? '' : ' (the SSOT block has no keys to read)';
        for (const k of KEYS) {
            const had = live[k];
            delete live[k];
            const r = probe(w, `FALLBACKS[${JSON.stringify(k)}]`);
            live[k] = had;
            if (!r.threw || !r.message.includes(k)) { noDefault = false; why += ` ${k}=>${r.threw ? 'threw without naming it: ' + r.message : 'returned ' + JSON.stringify(r.value)};`; }
        }
        check('with the key removed from the DB, FALLBACKS throws naming the key -- there is no default in code to fall back to', noDefault, why);
    });

    await section('3. the guard', async () => {
        const { w } = main;
        const k0 = KEYS[0];
        const saved = w.DB.global_rules.fallbacks;

        w.eval('DB = null');
        const early = probe(w, `FALLBACKS.${k0}`);
        w.eval('DB = window.DB');
        check('read before the SSOT is loaded (DB not set) throws, and says so', early.threw && /before the SSOT was loaded/i.test(early.message), early.threw ? early.message : 'returned ' + JSON.stringify(early.value));

        delete w.DB.global_rules.fallbacks;
        const absent = probe(w, `FALLBACKS.${k0}`);
        w.DB.global_rules.fallbacks = saved;
        check('a document without the block throws, naming global_rules.fallbacks', absent.threw && absent.message.includes('global_rules.fallbacks'), absent.threw ? absent.message : 'returned ' + JSON.stringify(absent.value));

        const typo = probe(w, 'FALLBACKS.no_such_fallback_key');
        check('a key nobody defined throws, naming it', typo.threw && typo.message.includes('no_such_fallback_key'), typo.threw ? typo.message : 'returned ' + JSON.stringify(typo.value));

        const before = (w.DB.global_rules.fallbacks || {})[k0];
        const write = probe(w, `FALLBACKS.${k0} = 123456`), del = probe(w, `delete FALLBACKS.${k0}`), def = probe(w, `Object.defineProperty(FALLBACKS, ${JSON.stringify(k0)}, { value: 1 })`);
        check('FALLBACKS cannot be written, deleted or redefined, and the SSOT value is untouched', write.threw && del.threw && def.threw && (w.DB.global_rules.fallbacks || {})[k0] === before,
            `write threw ${write.threw}, delete threw ${del.threw}, define threw ${def.threw}`);

        const keys = probe(w, 'Object.keys(FALLBACKS)'), has = probe(w, `${JSON.stringify(k0)} in FALLBACKS`), absentIn = probe(w, '"no_such_fallback_key" in FALLBACKS');
        check('enumerating FALLBACKS reports the SSOT\'s keys (not an empty object), annotations excluded', !keys.threw && JSON.stringify([...keys.value].sort()) === JSON.stringify(KEYS.slice().sort()),
            keys.threw ? keys.message : `[${[...keys.value]}]`);
        check('`in` agrees with the SSOT', has.value === true && absentIn.value === false);
        const annotation = probe(w, 'FALLBACKS._notes');
        check('the block\'s annotation keys are not served as fallback values', annotation.threw);
    });

    await section('4. boot order (Note B): no read of FALLBACKS before DB is set', async () => {
        const fb = main.log.proxies.findIndex(p => { try { return p === main.w.eval('FALLBACKS'); } catch (e) { return false; } });
        check('the spy saw the page construct FALLBACKS (non-vacuity: the instrument is attached to the real object)', fb >= 0, `${main.log.proxies.length} proxies seen`);
        const mine = bootReads.filter(r => r.proxy === fb);
        const early = mine.filter(r => !r.dbSet), late = mine.filter(r => r.dbSet);
        check(`reads of FALLBACKS before DB was set, over a complete real boot: ${early.length} (must be 0; counted only if the spy is attached to FALLBACKS)`, fb >= 0 && early.length === 0, fb < 0 ? 'the spy never saw FALLBACKS built, so a zero would mean nothing' : early.map(r => r.key).join(', '));
        console.log(`    (reads after DB was set, during the same boot: ${late.length}${late.length ? ' -- ' + [...new Set(late.map(r => r.key))].join(', ') : ''})`);

        const sentinelBefore = main.log.reads.length;
        probe(main.w, `FALLBACKS.${KEYS[0]}`);
        const seen = main.log.reads.slice(sentinelBefore).filter(r => r.proxy === fb && r.key === KEYS[0]);
        check('the spy counts a read made after boot (the counter moves when a read happens)', seen.length === 1 && seen[0].dbSet === true);

        // MUTANT: a read placed immediately before `DB = SERVICE_DATA`, the only moment DB is unset while the page runs.
        const anchor = /^([ \t]*)DB = SERVICE_DATA;[ \t]*$/m;
        check('mutant anchor present in the page (DB = SERVICE_DATA;)', anchor.test(html));
        const mutant = await boot({ spy: true, mutateHtml: h => h.replace(anchor, (m, ind) => `${ind}void FALLBACKS.${KEYS[0]};\n${m}`) });
        const mfb = mutant.log.proxies.findIndex(p => { try { return p === mutant.w.eval('FALLBACKS'); } catch (e) { return false; } });
        const mEarly = mutant.log.reads.filter(r => r.proxy === mfb && !r.dbSet);
        check('MUTANT (a FALLBACKS read just before DB is set) is counted by the same spy', mEarly.length === 1 && mEarly[0].key === KEYS[0], `${mEarly.length} early reads counted`);
        check('MUTANT is stopped by the guard: the boot fails and DB is never set (a loud failure, not an undefined in a price)', !mutant.w.DB);
        mutant.w.close();
    });

    await section('5. the schema gate holds the block (the page\'s own validator)', async () => {
        const { w } = main;
        const validate = d => w.orch_validate_ssot(d, SCHEMA);
        const base = validate(clone(SSOT));
        check('the SSOT as it stands is valid', base.valid === true, JSON.stringify((base.errors || []).slice(0, 2)));

        const noBlock = clone(SSOT); delete noBlock.global_rules.fallbacks;
        const v0 = validate(noBlock);
        check('a copy without global_rules.fallbacks is refused, naming it', v0.valid === false && v0.errors.some(e => /fallbacks/.test((e.path || '') + ' ' + e.message)), JSON.stringify((v0.errors || []).slice(0, 1)));

        let missing = KEYS.length ? [] : ['(no keys to remove: the block is absent)'], wrong = KEYS.length ? [] : ['(no keys to retype: the block is absent)'];
        for (const k of KEYS) {
            const a = clone(SSOT); delete a.global_rules.fallbacks[k];
            const va = validate(a);
            if (!(va.valid === false && va.errors.some(e => (e.path + ' ' + e.message).includes(k)))) missing.push(k);
            const b = clone(SSOT); b.global_rules.fallbacks[k] = typeof BLOCK[k] === 'number' ? 'not a number' : 12345;
            const vb = validate(b);
            if (!(vb.valid === false && vb.errors.some(e => (e.path || '').includes(k)))) wrong.push(k);
        }
        check(`removing ANY one of the ${KEYS.length} keys is refused, naming it`, missing.length === 0, `accepted without: [${missing}]`);
        check(`giving ANY one of the ${KEYS.length} keys the wrong type is refused, naming it`, wrong.length === 0, `accepted with the wrong type: [${wrong}]`);
        const extra = clone(SSOT); (extra.global_rules.fallbacks = extra.global_rules.fallbacks || {}).not_declared_in_schema = 1;
        const vx = validate(extra);
        check('a key the schema does not declare is refused (the surface cannot grow without the schema)', vx.valid === false && vx.errors.some(e => /not_declared_in_schema/.test((e.path || '') + ' ' + e.message)));

        const refused = await boot({ data: noBlock });
        check('the real page, given an SSOT without the block, does not boot (status invalid, DB never set)', refused.w.__ssotValidation && refused.w.__ssotValidation.status === 'invalid' && !refused.w.DB,
            refused.w.__ssotValidation ? `status ${refused.w.__ssotValidation.status}, DB set: ${!!refused.w.DB}` : 'no verdict');
        refused.w.close();
    });

    await section('6. the tail: every numeric default in every layer is filed, and the list only shrinks', async () => {
        // the scanner, on synthetic source (it must be able to see a default, and must ignore identity elements)
        const probeSrc = 'function f(a, b) { const x = a.p || 45; const y = b?.q ?? 0; const z = a.r ?? 1; const w2 = a.s || b.t || 12; const v = a.u ?? FALLBACKS.k; return x + y + z + w2 + v; }';
        const probeFound = numericDefaultsIn(Q.tryParseJs(probeSrc).ast.body[0]).map(d => `${d.op} ${d.value}`).sort();
        check('scanner: sees `|| 45` and the last operand of `a || b || 12`; ignores `?? 0`, `?? 1` and `?? FALLBACKS.k`', JSON.stringify(probeFound) === JSON.stringify(['|| 12', '|| 45']), `[${probeFound}]`);

        const { tally, errors, units } = scanPage(html);
        check('the scan covered the page (every inline block and external module parsed; functions found)', errors.length === 0 && units > 100, `${units} functions, ${errors.length} parse errors`);
        const added = Object.keys(tally).filter(k => !FILED[k] || tally[k] > FILED[k][0]);
        check('no numeric default is unfiled (a new one means: put the number in the SSOT, or file it in the ledger)', added.length === 0,
            added.map(k => `${k} ×${tally[k]}${FILED[k] ? ` (filed ${FILED[k][0]})` : ' (not filed)'}`).join('; '));
        const stale = Object.keys(FILED).filter(k => (tally[k] || 0) < FILED[k][0]);
        check('no filed default has gone (a retired one must be deleted from FILED so the list only shrinks)', stale.length === 0, stale.map(k => `${k} filed ×${FILED[k][0]}, found ×${tally[k] || 0}`).join('; '));
        const missingLedger = [...new Set(Object.values(FILED).map(v => v[1]))].filter(n => !new RegExp(`^### #${n} `, 'm').test(LEDGER));
        check('every filed default cites a ledger entry that exists in PENDING_DECISIONS.md', missingLedger.length === 0, `no entry for: [${missingLedger.map(n => '#' + n)}]`);
        const total = Object.values(tally).reduce((a, b) => a + b, 0);
        console.log(`    (${total} numeric defaults in ${Object.keys(tally).length} places; ${Object.values(FILED).reduce((a, v) => a + v[0], 0)} filed)`);
    });

    if (main) main.w.close();
    console.log(`\n[FALLBACKS and the numbers in code live in the SSOT] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
    process.exit(fail ? 1 : 0);
})();
