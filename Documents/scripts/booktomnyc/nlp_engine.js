/**
 * nlp_engine.js
 *
 * PHASE 1 — NLPEngine module (Logic / UI / Glue split, second module).
 * See pricing_engine.js for the first module and architecture_audit/ for
 * the full purity-audit methodology this is built on.
 *
 * v9.5 RE-EXTRACTION NOTE: this module had drifted stale relative to
 * qr.html — confirmed missing several real fixes from later in this same
 * session (the description-text weighted-signal mechanism, the
 * contextual_override word-order fix, the conjugation-aware word-boundary
 * extension, the clog/drain and microwave/stove group-resolution fixes).
 * Found while reviewing a request to extract the NLP engine as its own
 * module — discovered this extraction had ALREADY been done once, then
 * silently fallen behind, the same real drift pattern already documented
 * for pricing_engine.js. Re-extracted all 17 real functions directly from
 * the current, live qr.html using the same brace-counting method (and the
 * same DUPLICATED_FUNCTIONS_PREFER_LAST convention) cms_bridge.js already
 * trusts, verified each one standalone against real, previously-fixed test
 * cases from this session before treating this file as current again.
 *
 * IMPORTANT — this module contains TWO genuinely distinct NLP pipelines,
 * not one. This was discovered, not assumed: extractObject/extractQty/
 * extractLocation each exist TWICE in qr.html with different (in two cases
 * identical) signatures and meaningfully different parsing logic — verified
 * by direct comparison, not just by name collision. This is real,
 * intentional design, not accidental drift:
 *
 *   PREVIEW PIPELINE (suffixed `Preview` here to disambiguate): buildPreview,
 *   detectAction, detectActionInfinitive, extractObjectPreview,
 *   extractQtyPreview, extractLocationPreview, extractCondition. Powers the
 *   live-as-you-type debounced preview under the SmartQuote text box —
 *   fast, simpler heuristics, lower stakes (it only affects a "looks right"
 *   button label before final submission).
 *
 *   STRUCTURAL NOTE, found during extraction (not assumed going in): in the
 *   real qr.html, every one of these preview-pipeline functions is lexically
 *   NESTED inside enableLiveAdLibPreview() — they are not standalone
 *   top-level siblings there, unlike every function in pricing_engine.js.
 *   Verified by direct source inspection that none of them reference
 *   anything from that enclosing closure (textarea, previewDiv, textBar —
 *   the local DOM variables enableLiveAdLibPreview itself uses); they only
 *   read the module-scope STOP_WORDS/ACTIONS/etc. bindings (declared at
 *   block 0's true top level, outside enableLiveAdLibPreview) and their own
 *   parameters. That verified independence is WHY hoisting them to true
 *   top-level functions here is behaviorally safe, even though it changes
 *   their structural position relative to qr.html. Treat this file's
 *   preview-pipeline exports as a verified-equivalent reference module, not
 *   a literal mirror of qr.html's own internal code organization — they are
 *   private implementation details of one feature there, not part of its
 *   public/callable API surface.
 *
 *   ANALYSIS PIPELINE (original names, unchanged): detectIntentNLP,
 *   detectTagsNLP, extractObject, extractQty, extractLocation,
 *   extractSizeHint, inferTagsFromContext, resolveGroupFromIntent,
 *   isServiceVerb. These ARE genuine top-level functions in qr.html (block
 *   1), called directly from sqAnalyze and other SmartQuote flow code.
 *   Runs on actual submission — more thorough matching (full conjugation-
 *   table action detection, clause-boundary-aware object extraction), and
 *   its output genuinely affects pricing/intake, unlike the preview
 *   pipeline's cosmetic-only output.
 *
 * Both pipelines read from a SHARED data source: window._NLP, built once by
 * initNlpSets() (included below) from DB.negation_library (stop words,
 * prepositions, clause boundaries, service verb conjugations, room/location
 * words, condition phrases, verb-past-tense map, negative words) — the
 * actual SSOT data is genuinely shared; only the parsing ALGORITHMS differ
 * between the two pipelines, not the underlying word lists.
 *
 * REQUIRED SETUP, IN ORDER:
 *   1. Set window.DB / DB to the loaded btnyc.json (same as pricing_engine.js).
 *   2. Call initNlpSets() once — populates window._NLP from DB.negation_library.
 *   3. The PREVIEW pipeline additionally needs the module-scope destructuring
 *      below (STOP_WORDS, STOP_PREPS, SERVICE_VERBS, ROOMS, CONDITIONS,
 *      VERB_PAST_MAP, ACTIONS, QTY_WORDS) to have run AFTER step 2 — in
 *      qr.html this is a one-time top-level statement that executes when the
 *      script block loads (NOT inside initNlpSets, and NOT inside any
 *      function — verified directly against the source before assuming
 *      otherwise, since an earlier draft of this extraction incorrectly
 *      omitted it, causing extractObjectPreview to throw "ACTIONS is not
 *      defined"). Call refreshNlpPreviewBindings() (added below, wrapping
 *      that exact destructuring in a callable form so this module doesn't
 *      depend on top-level script execution order) once after initNlpSets().
 *      The ANALYSIS pipeline does not need this step — it reads window._NLP
 *      lazily via the _SKIP_WORDS()/_SVC_VERBS()/etc. accessors below
 *      instead, so it always sees current data even if called before
 *      refreshNlpPreviewBindings() — preserved exactly as qr.html has it,
 *      not "fixed" to be consistent, since changing that would be exactly
 *      the kind of unverified behavior change this extraction must avoid.
 *
 * isServiceVerb additionally takes a VERBS set as its second argument
 * (typically window._NLP.VERBS via the _SVC_VERBS() accessor) rather than
 * reading window._NLP directly itself, matching how it's actually called in
 * qr.html — preserved here exactly, not "cleaned up".
 *
 * Loaded as a plain global-scope <script> (not an ES module) — same
 * rationale as pricing_engine.js. qr.html itself was NOT modified to load
 * this file (it remains fully self-contained, single-file deployment) —
 * see CHANGELOG_v9.4.md for the same deployment-model decision made for
 * pricing_engine.js, which applies identically here.
 */

// ───────────────────────── Shared setup (required) ─────────────────────────

function initNlpSets() {
    const nl = window.DB?.negation_library || {};
    const actionConj = nl.action_conjugations || {};

    // Build ONE matching regex + a WORD-LEVEL infinitive map per action, from
    // the SSOT conjugation table (negation_library.action_conjugations)
    // instead of hand-written regex literals that only matched bare
    // infinitives. Fixes two bugs:
    //   1. "window fixed" detected action='service' (generic fallback)
    //      instead of 'Repair' — /\bfix\b/ doesn't match "fixed".
    //   2. "mount a sign" / "hang a sign" echoed back as "install my sign"
    //      — Install and "Install / Mount" used to be two competing entries
    //      that each listed the other's verb as a synonym (non-deterministic
    //      ordering), AND the fix for that only special-cased "mount",
    //      leaving "hang"/"put up" still wrongly collapsing to "install".
    // Fix: each action's all_forms gets the action's own default infinitive;
    // each synonym_cluster gets ITS OWN infinitive — so every distinct verb
    // the user might type (fix/patch/restore/adjust, install/mount/hang/put up,
    // etc.) echoes back as itself, never silently swapped for a different word.
    const ACTIONS = [];
    const buildWordMap = (def) => {
        const map = {};
        const defaultInf = def.infinitive_for_adlib || '';
        (def.all_forms || []).forEach(f => { map[f.toLowerCase()] = defaultInf; });
        (def.synonym_clusters || []).forEach(cluster => {
            (cluster.forms || []).forEach(f => { map[f.toLowerCase()] = cluster.infinitive; });
        });
        return map;
    };
    const allForms = (def) => {
        const forms = [...(def.all_forms || [])];
        (def.synonym_clusters || []).forEach(cluster => forms.push(...(cluster.forms || [])));
        return forms;
    };
    for (const [key, def] of Object.entries(actionConj)) {
        if (key.startsWith('_')) continue; // skip _note, _extra_actions_not_tied_to_service_type
        const forms = allForms(def);
        if (!forms.length) continue;
        const pattern = new RegExp('\\b(' + forms.map(f => f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')\\b', 'i');
        ACTIONS.push({
            serviceTypeKey: key,                          // e.g. 'Repair' — maps to service_types
            infinitive: def.infinitive_for_adlib || key.toLowerCase(),
            wordInfinitiveMap: buildWordMap(def),          // word-level echo-back
            pattern
        });
    }
    // Extra actions (remove/replace) not tied to a service_type — still
    // matchable for object-boundary detection, but carry no serviceTypeKey.
    const extra = actionConj._extra_actions_not_tied_to_service_type || {};
    for (const [key, def] of Object.entries(extra)) {
        const forms = allForms(def);
        if (!forms.length) continue;
        const pattern = new RegExp('\\b(' + forms.map(f => f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')\\b', 'i');
        ACTIONS.push({
            serviceTypeKey: null, infinitive: def.infinitive_for_adlib || key,
            wordInfinitiveMap: buildWordMap(def), pattern, _extraKey: key
        });
    }

    window._NLP = {
        STOP:   new Set(nl.nlp_stop_words        || []),
        PREPS:  new Set(nl.nlp_stop_preps        || []),
        CLAUSE: new Set(nl.nlp_clause_boundaries || []),
        VERBS:  new Set(nl.nlp_service_verbs     || []),
        ROOMS:  nl.nlp_location_words            || [],
        CONDS:  nl.nlp_condition_phrases         || [],
        VMAP:   nl.nlp_verb_past_map             || {},
        NEG:    new Set(nl.negative_words        || []),
        ACTIONS                                            // NEW: SSOT action matcher
    };
}

// Lazy accessors used by the ANALYSIS pipeline to read the shared word sets.
const _SKIP_WORDS  = () => window._NLP?.STOP   || new Set();
const _SVC_VERBS   = () => window._NLP?.VERBS  || new Set();
const _STOP_PREPS  = () => window._NLP?.PREPS  || new Set();
const _CLAUSE_BOUNDARY = () => window._NLP?.CLAUSE || new Set();
const _ROOMS_LIST  = () => window._NLP?.ROOMS  || [];

// ───────────────────────── PREVIEW pipeline ─────────────────────────

// v9.4: in qr.html, this destructuring is a one-time top-level statement in
// the SAME script block as the preview-pipeline functions below, executed
// once when that block loads (after initNlpSets() has already run earlier
// in the page). Wrapped here in a named function so this standalone module
// has an explicit call instead of relying on top-level execution order.
let STOP_WORDS, STOP_PREPS, SERVICE_VERBS, ROOMS, CONDITIONS, VERB_PAST_MAP, ACTIONS, QTY_WORDS;
function refreshNlpPreviewBindings() {
    ({ STOP: STOP_WORDS, PREPS: STOP_PREPS, VERBS: SERVICE_VERBS,
       ROOMS, CONDS: CONDITIONS, VMAP: VERB_PAST_MAP, ACTIONS } = window._NLP || {});
    QTY_WORDS = new Set(['one','two','three','four','five','six','seven','eight','nine','ten']);
}

function buildPreview(text) {
        const t = text.trim();
        if (!t) return '<span class="preview-empty">✨ Describe your job — we\'ll build a clear request for you</span>';
        const qty  = extractQty(t);
        const infinitive = detectActionInfinitive(t);   // "fix", not "fixed"/"repaired" — grammatically correct after "to"
        const obj  = extractObject(t);
        const loc  = extractLocation(t);
        const cond = extractCondition(t);
        // v9.4 SECURITY FIX (CodeQL: "Incomplete string escaping or encoding"):
        // previously only escaped &, <, > — missing the quote characters needed
        // to safely escape content that might ever land inside an HTML attribute
        // value. Not exploitable today (every esc() call site below lands in
        // plain text content between tags, never inside an attribute), but
        // incomplete escaping is exactly the kind of latent gap that becomes
        // exploitable the moment a future edit moves one of these into an
        // attribute context (e.g. a title="${s}" tooltip). Widened to the same
        // complete 5-character escape set as the shared escapeHtml() utility
        // in block 1 (this is block 0, a separate script-block scope, so it
        // can't reference that one directly — kept self-contained here,
        // consistent with how this block already manages its own utilities).
        const esc  = s => s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

        // SSOT: sentence_start moved to adlib_phrase_overrides.adlib in the
        // JSON consolidation (was ui_config.adlib) — read from new location.
        const adlibCfg = window.DB?.adlib_phrase_overrides?.adlib || {};
        const start = adlibCfg.sentence_start || 'I need';
        const locPrefix = adlibCfg.location_prefix || 'in my';

        // "I need to fix my window" — infinitive-first frame (matches the
        // "I need to ___ my ___" pattern), not "I need window serviced".
        let s = start + ' to ' + infinitive;
        if (obj) {
            s += ' my ';
            if (qty > 1) s += qty + ' ';
            s += esc(obj);
        }
        // Condition phrases come in two grammatical shapes:
        //  - adjective/gerund style ("leaking", "broken", "clogged") fits
        //    "because it is ___" naturally.
        //  - clause style ("can't open", "won't close") is already a full
        //    clause and reads wrong with "because it is" in front of it
        //    ("because it is can't open" is not valid English).
        // Detect clause-style by its leading word and use "because it"
        // (no "is") for those instead.
        if (cond) {
            const isClauseStyle = /^(can't|cant|won't|wont|doesn't|doesnt|cannot)\b/.test(cond);
            s += isClauseStyle ? ' because it ' + esc(cond) : ' because it is ' + esc(cond);
        }
        if (loc)  s += ' ' + locPrefix + ' ' + esc(loc);
        return `<i class="ti ti-sparkles"></i><span class="preview-phrase">${s.trim()}</span><span class="preview-tag">live</span>`;
    }

function detectAction(text) {
        const l = text.toLowerCase().replace(/\u2019/g,"'");
        // SSOT match first: action_conjugations covers ALL conjugated forms
        // (fixed/fixing/repairs/mounted/etc), not just bare infinitives —
        // this is what fixes "window fixed" being misdetected as 'service'.
        if (ACTIONS && ACTIONS.length) {
            for (const a of ACTIONS) {
                if (a.pattern.test(l)) {
                    if (a.serviceTypeKey) return SVC_TYPE_TO_LEGACY_ACTION[a.serviceTypeKey] || 'service';
                    if (a._extraKey) return a._extraKey; // 'remove' / 'replace'
                }
            }
        }
        // Negation phrasing ("can't", "won't") still implies something's broken -> repair
        if (/\b(can't|cant|won't|wont|doesn't|doesnt)\b/.test(l)) return 'repair';
        if (/\b(unclog|unclogging|unblock|drain)\b/.test(l))      return 'repair';
        // SSOT fallback: any condition phrase already in the JSON (broken,
        // clogged, stuck, cracked, etc. — see negation_library.nlp_condition_phrases)
        // describes a malfunction, which by definition implies repair intent.
        // Fixes "door handle broken" / "sink is clogged" falling through to
        // the generic 'service' bucket even though detectCondition() already
        // recognizes these exact words for the parenthetical condition display.
        if (CONDITIONS && CONDITIONS.some(([pattern]) => l.includes(pattern))) return 'repair';
        return 'service';
    }

function detectActionInfinitive(text) {
        const l = text.toLowerCase().replace(/\u2019/g,"'");
        if (ACTIONS && ACTIONS.length) {
            for (const a of ACTIONS) {
                const m = a.pattern.exec(l);
                if (m) {
                    const matchedWord = m[1].toLowerCase();
                    // Echo back the literal word's own infinitive if the
                    // table defines one (e.g. "mount" -> "mount"), else
                    // fall back to the action's single default infinitive.
                    return (a.wordInfinitiveMap && a.wordInfinitiveMap[matchedWord]) || a.infinitive;
                }
            }
        }
        if (/\b(can't|cant|won't|wont|doesn't|doesnt)\b/.test(l)) return 'fix';
        if (/\b(unclog|unclogging|unblock|drain)\b/.test(l))      return 'fix';
        // SSOT fallback, mirrors detectAction() — see comment there.
        if (CONDITIONS && CONDITIONS.some(([pattern]) => l.includes(pattern))) return 'fix';
        return 'have serviced';
    }

function extractObjectPreview(text) {
        const l = text.toLowerCase().replace(/\u2019/g,"'").replace(/[.,!?;:]/g,' ');
        const words = l.split(/\s+/).filter(Boolean);
        const n = words.length;
        const collect = (start) => {
            const obj = [];
            for (let i = start; i < n && i < start+4; i++) {
                const w = words[i];
                if (STOP_PREPS.has(w)) break;
                if (STOP_WORDS.has(w) || QTY_WORDS.has(w) || /^\d/.test(w)) continue;
                obj.push(w);
            }
            return obj;
        };
        // Pattern 0: <noun> [aux chain] <verb-past> ... — common passive
        // phrasing ("tv mounted on brick wall", "sink is clogged",
        // "ac unit needs to be installed"). The object comes BEFORE the
        // verb here, which none of patterns 1-4 handle (they all assume
        // verb-then-object or "my "-prefixed object), so this phrasing
        // previously fell through to the weak single-word fallback, which
        // could pick the wrong word entirely (e.g. "brick" instead of "tv",
        // or "needs" itself instead of the actual object before it).
        if (ACTIONS && ACTIONS.length) {
            const actionWordIdx = words.findIndex(w => ACTIONS.some(a => a.pattern.test(w)));
            if (actionWordIdx > 0) {
                // Skip back over an entire auxiliary/modal chain, not just
                // one word — "needs to be", "is going to be", "has been"
                // can all precede the actual verb. Without this, "needs"
                // (a modal, not the object) gets collected as if it WERE
                // the object once "to"/"be" are filtered as stop words.
                const AUX_CHAIN = new Set(['is','are','was','were','has','have','had',
                    'be','been','being','to','needs','need','going','will','should','must']);
                let end = actionWordIdx;
                while (end > 0 && AUX_CHAIN.has(words[end - 1])) end--;
                const obj = [];
                for (let i = Math.max(0, end - 3); i < end; i++) {
                    const w = words[i];
                    if (STOP_WORDS.has(w) || STOP_PREPS.has(w) || /^\d/.test(w)) continue;
                    obj.push(w);
                }
                if (obj.length) return obj.join(' ');
            }
        }
        // Pattern 1: <verb> [art] [qty] <noun>
        // SSOT: isServiceVerb (defined in the main script block) also matches
        // hyphenated "re-" forms (re-glue -> reglue) that a raw .has() lookup
        // misses entirely, since tokenization never strips hyphens. Falls back
        // to a plain .has() if isServiceVerb isn't yet defined (defensive only
        // — in practice this module is invoked well after the main script
        // block has run, so the real helper is always available by then).
        const _isVerb = (typeof isServiceVerb === 'function')
            ? (w) => isServiceVerb(w, SERVICE_VERBS)
            : (w) => SERVICE_VERBS.has(w);
        const vi = words.findIndex(w => _isVerb(w));
        if (vi !== -1) {
            let s = vi + 1;
            if (s < n && /^(my|the|a|an|one|your)$/.test(words[s])) s++;
            if (s < n && (QTY_WORDS.has(words[s]) || /^\d/.test(words[s]))) s++;
            const o = collect(s); if (o.length) return o.join(' ');
        }
        // Pattern 2: need [art] [qty] <noun> [done/fixed…]
        const ni = words.findIndex(w => w === 'need');
        if (ni !== -1) {
            let s = ni + 1;
            if (s < n && /^(my|the|a|an|your|this)$/.test(words[s])) s++;
            if (s < n && (QTY_WORDS.has(words[s]) || /^\d/.test(words[s]))) s++;
            // END boundary markers derived from the SAME SSOT action_conjugations
            // table detectAction() uses — was a separately hand-maintained list
            // that could (and did) drift out of sync with the action matcher.
            const END = new Set(['done', 'working', 'cleaned', 'checked']);
            if (ACTIONS && ACTIONS.length) {
                ACTIONS.forEach(a => {
                    const m = a.pattern.source.match(/\(([^)]+)\)/);
                    if (m) m[1].split('|').forEach(f => END.add(f));
                });
            }
            const obj = [];
            for (let i = s; i < n && i < s+4; i++) {
                const w = words[i];
                if (STOP_PREPS.has(w) || END.has(w)) break;
                if (STOP_WORDS.has(w) || QTY_WORDS.has(w) || /^\d/.test(w)) continue;
                obj.push(w);
            }
            if (obj.length) return obj.join(' ');
        }
        // Pattern 3: can't/cant <verb> [art] <noun>
        const ci = words.findIndex(w => /^(cant|can't|cannot)$/.test(w));
        if (ci !== -1) {
            let s = ci + 2;
            if (s < n && /^(my|the|a|an|your)$/.test(words[s])) s++;
            const o = collect(s); if (o.length) return o.join(' ');
        }
        // Pattern 4: my <noun> is <cond>
        const mi = words.findIndex(w => w === 'my');
        if (mi !== -1) {
            let s = mi + 1;
            const obj = [];
            for (let i = s; i < n && i < s+3; i++) {
                const w = words[i];
                if (/^(is|are|was|has|have|will|does)$/.test(w) || STOP_PREPS.has(w)) break;
                if (!STOP_WORDS.has(w) && !/^\d/.test(w)) obj.push(w);
            }
            if (obj.length) return obj.join(' ');
        }
        // Fallback: first content word. length > 2 filters out noise like
        // "a", "in", "to" that slip past STOP_WORDS — but it also wrongly
        // excludes legitimate short nouns like "tv" (2 chars). Allowlist a
        // small set of real short object-words rather than lowering the
        // general threshold, which would let real noise back in.
        const SHORT_OBJECT_ALLOWLIST = new Set(['tv', 'ac']);
        for (const w of words) {
            if (STOP_WORDS.has(w) || STOP_PREPS.has(w) || QTY_WORDS.has(w) || _isVerb(w) || /^\d/.test(w)) continue;
            if (w.length > 2 || SHORT_OBJECT_ALLOWLIST.has(w)) return w;
        }
        return '';
    }

function extractQtyPreview(text) {
        const UNITS = 'items?|pieces?|tvs?|signs?|lights?|doors?|shelves?|outlets?|switches?|fixtures?|tiles?|panels?|fans?';
        let m = text.match(new RegExp('\\b(\\d+)\\s*(?:' + UNITS + ')', 'i'));
        if (m) return Math.min(parseInt(m[1]), 99);
        // SSOT: same dimension/measurement guard as the canonical extractQty —
        // a hyphenated word-number followed by a hyphen is part of a compound
        // adjective ("four-poster", "six-foot-tall"), not a standalone count.
        // (?!-) rejects exactly that case while still matching a genuine
        // standalone count word ("I need four doors fixed").
        const wmap = {one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10};
        for (const [w,n] of Object.entries(wmap)) {
            if (new RegExp('\\b' + w + '\\b(?!-)', 'i').test(text)) return n;
        }
        // Bare-digit fallback: strip dimension/measurement phrases first, so a
        // leftover number ("4-foot", "7-foot-long") isn't misread as a count —
        // a real, live pricing bug (qty multiplies the final price) found by
        // stress-testing real job descriptions containing measurements.
        const DIMENSION_PATTERN = /\b\d+\s*-?\s*(?:foot|feet|ft|inch|inches|in|cm|centimeters?|meters?|yards?|lbs?|pounds?|kg)\b/gi;
        const stripped = text.replace(DIMENSION_PATTERN, ' ');
        m = stripped.match(/\b(\d+)\b/);
        return m ? Math.min(parseInt(m[1]),99) : 1;
    }

function extractLocationPreview(text) {
        const l = text.toLowerCase();
        for (const room of ROOMS) { if (l.includes(room)) return room; }
        const m = l.match(/\b(?:in|inside|at)\s+(?:my|the|our|a)?\s*([a-z][a-z]{2,}(?:\s+[a-z]+)?)\b/);
        if (m) { const c = m[1].trim(); if (!STOP_WORDS.has(c) && !SERVICE_VERBS.has(c) && c.length > 2) return c; }
        return null;
    }

function extractCondition(text) {
        const l = text.toLowerCase().replace(/\u2019/g,"'");
        for (const [pattern, display] of CONDITIONS) { if (l.includes(pattern)) return display; }
        return null;
    }

// ───────────────────────── ANALYSIS pipeline ─────────────────────────

function detectIntentNLP(text) {
                    const lower = text.toLowerCase();
                    let maps = DB.intent_mappings || [];
                    if (!Array.isArray(maps) && maps.objects) maps = maps.objects;
                    const normStype = s => (window._normServiceType ? window._normServiceType(s) : (s || 'Repair').replace('Install / Mount', 'Install').replace('Install/Mount', 'Install'));

                    let best = null,
                        top = 0,
                        bestMapping = null;
                    // v9.5 FIX (severe, previously-undiscovered bug, found while
                    // fact-checking an external analysis against real data):
                    // lower.includes(kw) is a bare substring check, so "washer"
                    // matched inside "dishwasher" — confirmed via direct test
                    // that "dishwasher is leaking water" silently resolved to
                    // washer_repair (the wrong appliance entirely), since both
                    // keywords score equally (confidence_weight 90 each) and the
                    // tie-break is pure array order (washer happens to come
                    // first). Confirmed this is the ONLY real keyword pair in
                    // the current catalog with this exact substring
                    // relationship, but fixed the general MECHANISM with a real
                    // word-boundary match rather than patch this one instance,
                    // since the same class of bug could recur with any future
                    // keyword addition. Multi-word "label-only" keywords (e.g.
                    // "tile / floor") never matched via this primary check
                    // either way, before or after this fix — their real
                    // matching is entirely through single-word synonyms,
                    // confirmed via direct check; this fix changes nothing for
                    // them.
                    const wordBoundaryIncludes = (text, term) => {
                        if (!term) return false;
                        const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                        // v9.5 FIX (PERMANENT, not a patch): extends the
                        // original plural-only fix (s/es) to also handle verb
                        // conjugations (ed/ing) and the silent-e-drop pattern
                        // (replace->replacing) -- confirmed via direct test
                        // that "I need this installed" previously failed to
                        // match a bare "install" synonym, an ordinary phrasing
                        // gap affecting every verb synonym in the catalog, not
                        // just newly-added ones. Confirmed washer still
                        // correctly rejects dishwasher with this exact pattern.
                        const silentEDrop = term.endsWith('e') ? escaped.slice(0, -1) : null;
                        const altPattern = silentEDrop ? '|' + silentEDrop + '(?:ed|ing)' : '';
                        return new RegExp('\\b(?:' + escaped + "(?:'?s|es|ed|ing)?" + altPattern + ')\\b', 'i').test(text);
                    };
                    const isInflectionOnly = (kwl, synl) => {
                        if (synl === kwl) return true;
                        if (!synl.startsWith(kwl)) return false;
                        const suffix = synl.slice(kwl.length);
                        if (/^('?s|es|ed|ing)?$/.test(suffix)) return true;
                        return kwl.endsWith('e') && /^(ed|ing)$/.test(suffix);
                    };
                    for (const m of maps) {
                        let score = 0;
                        const kw = (m.keyword || '').toLowerCase(),
                            w = m.confidence_weight || 30;
                        const kwMatched = !!(kw && wordBoundaryIncludes(lower, kw));
                        if (kwMatched) score += w;
                        if (Array.isArray(m.synonyms))
                            m.synonyms.forEach(s => {
                                if (typeof s !== 'string') return;
                                const sl = s.toLowerCase();
                                // v9.5 FIX (correcting a real bug in the
                                // immediately-prior fix, caught by re-running
                                // the test suite): the previous check
                                // (wordBoundaryIncludes(sl, kw)) incorrectly
                                // treated ANY synonym containing the keyword
                                // as redundant, including genuinely distinct,
                                // more-specific real phrases like "gfci
                                // outlet" (starts with "gfci" but is NOT
                                // redundant — it's a real, more specific
                                // synonym that should still score). The
                                // correct, narrower check: skip ONLY when the
                                // synonym is the bare keyword plus nothing or
                                // an inflectional suffix only (the SAME word,
                                // a different grammatical form — e.g.
                                // "leak"/"leaking", "baseboard"/"baseboards"),
                                // never when real, additional distinguishing
                                // words follow.
                                if (kwMatched && isInflectionOnly(kw, sl)) return;
                                if (wordBoundaryIncludes(lower, sl)) score += w * .5;
                            });
                        score = Math.min(score, 100);
                        if (score > top) {
                            top = score;
                            bestMapping = m;
                            best = {
                                category: m.default_dynamic_category || m.fallback?.category || 'other',
                                stype: normStype(m.default_service_type || m.fallback?.service_type || 'Repair'),
                                group: m.keyword,
                                base: m.fallback?.base_price || 70,
                                key: m.keyword,
                                label: m.keyword,
                                qtyLabel: 'item',
                                // v9.5 FIX: confirmed via direct execution that this real,
                                // designed field (the "install"/"setup" intent_mappings
                                // entry's resolver:"object_based") was NEVER copied onto
                                // the returned intent object at all — meaning the entire
                                // object-based re-resolution mechanism (distinguishing
                                // "install a TV" from "install a faucet" by the OBJECT,
                                // not just the shared verb) was completely unreachable in
                                // BOTH the legacy sqAnalyze code AND this session's own
                                // orchestrator port of that same logic. The consuming
                                // branches (legacy: S.intent.resolver === 'object_based';
                                // orchestrator: orch_apply_object_based_resolution) were
                                // both already correctly built — they simply never had
                                // real data to act on until this line existed.
                                resolver: m.resolver || null,
                                recommendedSku: m.default_service_sku || null,
                                // The actual confidence score used to pick this match —
                                // was computed and then discarded before; now attached
                                // so downstream code (the recommendedSku banner's
                                // auto-select) can gate on the REAL number instead of
                                // re-estimating or assuming a SKU implies confidence.
                                _matchConfidence: score,
                                dynamic_rule: m.dynamic_rule || null,
                                _ctxFee: 0,
                                _ctxMin: 0,
                                _ctxTags: []
                            };
                        }
                    }

                    // SSOT: contextual_overrides — secondary keyword refinements
                    // e.g. "toilet" + "flushometer" → inject #flushometer tag + +$75 +45min
                    // e.g. "light fixture" + "chandelier" → override base to $90
                    if (best && bestMapping?.contextual_overrides) {
                        for (const ctx of bestMapping.contextual_overrides) {
                            const ctxKws = (ctx.keywords || []).filter(k => typeof k === 'string');
                            // v9.5 FIX (severe, previously-undiscovered, catalog-wide
                            // bug found via an external analysis's real test corpus):
                            // the old multi-word fallback
                            // (kwParts.every(w => ctxWords.has(w))) was
                            // order-and-adjacency-blind — it treated "replace [any
                            // words] toilet" the same as the genuine phrase "replace
                            // toilet". Confirmed via direct test: "replace a wax ring
                            // on toilet" incorrectly matched this exact override,
                            // resolving to toilet_install ($100) instead of the
                            // correct toilet_wax_ring_replacement ($65) — a real $35
                            // overcharge. Confirmed this risk existed on all 18 real
                            // multi-word override keywords catalog-wide, and
                            // confirmed via direct test that every genuine, intended
                            // multi-word match (e.g. "set up my microwave", "mount a
                            // flat screen tv") already works correctly via the exact-
                            // substring check alone — the word-bag fallback was
                            // unnecessary as well as dangerous. Removed entirely.
                            const ctxMatched = ctxKws.some(kw => lower.includes(kw.toLowerCase()));
                            if (!ctxMatched) continue;
                            // Override to a more specific named service — e.g.
                            // 'door' + 'lock' → door_lock_or_handle_install instead
                            // of the generic door default. This is the field that
                            // makes the recommendedSku banner point at the right,
                            // specific service for contextual sub-cases.
                            // Was defined in the JSON schema and authored in data,
                            // but never consumed by any JS — wired here now.
                            if (ctx.override_sku) {
                                best.recommendedSku = ctx.override_sku;
                                // v9.5 FIX (real root cause of a genuine
                                // regression found via testing): a direct,
                                // explicit flag for "a contextual_override
                                // already changed recommendedSku" — the
                                // description-override mechanism below
                                // previously used _ctxTags.length as a proxy
                                // for this, but a real override (e.g.
                                // hard_drive's "back up" -> data_backup_or_transfer)
                                // can fire with no smart_tag at all, so the
                                // proxy silently missed it and let the new
                                // mechanism re-override an already-correct
                                // answer.
                                best._hadContextualOverride = true;
                            }
                            // Override base price
                            if (ctx.override_base_price) best.base = ctx.override_base_price;
                            // Accumulate fee/time adjustments
                            if (ctx.adjustment_fee) best._ctxFee += ctx.adjustment_fee;
                            if (ctx.adjustment_minutes) best._ctxMin += ctx.adjustment_minutes;
                            // Resolve smart_tag $ref → find tag ID
                            if (ctx.smart_tag && ctx.smart_tag.$ref) {
                                // $ref like '#/smart_tags/#flushometer' → tag ID '#flushometer'
                                const segments = ctx.smart_tag.$ref.replace(/^#\//, '').split('/');
                                const tagId = segments[segments.length - 1]; // '#flushometer'
                                if (DB.smart_tags?.[tagId] && !best._ctxTags.includes(tagId))
                                    best._ctxTags.push(tagId);
                            }
                        }
                    }

                    if (!best) {
                        const fb = DB.intent_mappings?.default_fallback;
                        if (fb) best = {
                            category: fb.category || 'other',
                            stype: normStype(fb.service_type || 'Repair'),
                            group: 'other',
                            base: fb.base_price || 70,
                            key: 'other',
                            label: 'Other',
                            qtyLabel: 'item',
                            dynamic_rule: null,
                            _ctxFee: 0,
                            _ctxMin: 0,
                            _ctxTags: []
                        };
                    }
                    // v9.5 — real, designed, weighted multi-signal check
                    // (description-based sibling override), verified
                    // directly against real data before building. Only
                    // runs when the keyword match resolved a real,
                    // specific service AND no contextual_override already
                    // fired (this is a genuine fallback signal, not a
                    // competing scorer). Checks whether the LEFTOVER words
                    // in the customer's text — after removing words the
                    // matched keyword itself already accounts for — match
                    // a SIBLING service's real description more
                    // specifically than the default winner's own
                    // description. Confirmed via direct test: correctly
                    // overrides dimmer_switch_install -> smart_switch_install
                    // for "swap the hallway dimmer for a smart version"
                    // (leftover word "smart" matches smart_switch_install's
                    // real description, scores 0 against dimmer's own);
                    // correctly does NOT override a plain "swap a dimmer"
                    // request (no real leftover signal); correctly does NOT
                    // override on a word both siblings share (a genuine
                    // tie is not a clear signal).
                    if (best && best.recommendedSku && !best._hadContextualOverride) {
                        const winningSvc = (DB.services || []).find(s => s.id === best.recommendedSku);
                        if (winningSvc?.ui_taxonomy?.group_id) {
                            const SVC_VERBS = new Set((DB.negation_library?.nlp_service_verbs || []).map(v => v.toLowerCase()));
                            const STOP_WORDS = new Set((DB.negation_library?.nlp_stop_words || []).map(v => v.toLowerCase()));
                            // v9.5 FIX (replaces the narrower, hand-rolled
                            // multi-word verb list from a prior fix): found
                            // the real, already-existing, far more
                            // comprehensive ACTIONS table while reviewing a
                            // real proposal to extend action_conjugations.
                            // ACTIONS is built from negation_library.
                            // action_conjugations (the genuine SSOT),
                            // already correctly handles every conjugated
                            // form including genuine multi-word phrases
                            // ("put up", "put in", "rehang", etc — not just
                            // the 4 verbs the prior fix happened to hand-list),
                            // and is the SAME compiled table
                            // detectActionInfinitive already correctly uses
                            // elsewhere. Strips every real, matched action
                            // phrase from the text before word-splitting.
                            const stripActionPhrases = (t) => {
                                let out = t;
                                const liveActions = (window._NLP && window._NLP.ACTIONS) || [];
                                for (const a of liveActions) out = out.replace(a.pattern, ' ');
                                return out;
                            };
                            const realWordList = (t) => (stripActionPhrases(t.toLowerCase()).match(/[a-z']+/g) || []).filter(w => !SVC_VERBS.has(w) && !STOP_WORDS.has(w));
                            const keywordWordSet = new Set(realWordList(bestMapping?.keyword || ''));
                            // v9.5 FIX (4th real bug found via systematic
                            // testing across all 21 real multi-service
                            // groups): stripping only the bare keyword
                            // ("screen") left "window" un-stripped from a
                            // matched multi-word synonym ("window screen"),
                            // letting it spuriously match an unrelated
                            // sibling's description that happened to also
                            // contain the word "window". Every real
                            // synonym of the winning keyword that genuinely
                            // matches the text represents words already
                            // accounted for by the primary match, not just
                            // the bare keyword string.
                            if (Array.isArray(bestMapping?.synonyms)) {
                                for (const syn of bestMapping.synonyms) {
                                    if (typeof syn === 'string' && wordBoundaryIncludes(lower, syn.toLowerCase())) {
                                        for (const w of realWordList(syn)) keywordWordSet.add(w);
                                    }
                                }
                            }
                            const leftoverWords = realWordList(lower).filter(w => !keywordWordSet.has(w));
                            if (leftoverWords.length > 0) {
                                const siblings = (DB.services || []).filter(s =>
                                    s.ui_taxonomy?.group_id === winningSvc.ui_taxonomy.group_id && s.id !== winningSvc.id
                                );
                                const scoreAgainst = (svc) => {
                                    const desc = (svc.ui_taxonomy?.description || '').toLowerCase();
                                    return leftoverWords.filter(w => wordBoundaryIncludes(desc, w)).length;
                                };
                                const defaultScore = scoreAgainst(winningSvc);
                                let bestSibling = null, bestSiblingScore = defaultScore;
                                for (const sib of siblings) {
                                    const s = scoreAgainst(sib);
                                    if (s > bestSiblingScore) { bestSiblingScore = s; bestSibling = sib; }
                                }
                                if (bestSibling) {
                                    best.recommendedSku = bestSibling.id;
                                    best._descriptionOverride = true;
                                }
                            }
                        }
                    }
                    return best;
                }

function detectTagsNLP(text) {
                    const lower = text.toLowerCase().replace(/[.,!?;:]/g, '');
                    const words = new Set(lower.split(/\s+/)); // word set for multi-word synonym fallback
                    const tags = DB.smart_tags || {};
                    const found = [],
                        negated = [];
                    const neg = ['not', "isn't", 'isnt', 'no', 'without', "don't", 'dont', 'non', 'never', 'neither', 'nor', 'nothing', 'nowhere', 'hardly', 'barely', 'wont', 'won\'t'];
                    for (const [tid, t] of Object.entries(tags)) {
                        let hit = false,
                            neg_ = false;
                        const syns = (t.synonyms?.length) ? t.synonyms.filter(s => typeof s === 'string') : [tid.replace('#', '').replace(/_/g, ' ')];
                        for (const s of syns) {
                            const sl = s.toLowerCase();
                            // Try exact substring first
                            let idx = lower.indexOf(sl);
                            // If not found as phrase, try all-words-present match for multi-word synonyms
                            if (idx === -1 && sl.includes(' ')) {
                                const synWords = sl.split(/\s+/);
                                if (synWords.length >= 2 && synWords.every(w => words.has(w))) {
                                    // Find position of first synonym word for negation check
                                    idx = lower.indexOf(synWords[0]);
                                }
                            }
                            if (idx !== -1) {
                                const pre = lower.slice(Math.max(0, idx - 20), idx).trim().split(' ');
                                if (pre.slice(-3).some(w => neg.includes(w))) {
                                    neg_ = true;
                                    break;
                                } else hit = true;
                            }
                        }
                        if (neg_) negated.push(tid);
                        else if (hit) found.push(tid);
                    }
                    return {
                        found,
                        negated
                    };
                }

function extractObject(text, intentKeyword) {
                    const SKIP = _SKIP_WORDS(), VERBS = _SVC_VERBS(), PREPS = _STOP_PREPS();
                    const CLAUSE = _CLAUSE_BOUNDARY();
                    const lower = text.toLowerCase().replace(/[.,!?;:]/g, ' ');
                    const kw = (intentKeyword || '').toLowerCase();
                    // v9.5 FIX (second real gap, found while tracing the
                    // original plural-windows scenario backlog item B was
                    // built around): the old logic only recognized the EXACT
                    // canonical keyword string (e.g. "window"), never any of
                    // its real, declared synonyms (e.g. "windows",
                    // "windowpane") — meaning a customer using the realistic,
                    // common plural/synonym form got zero object extraction
                    // unless a recognized verb also happened to appear.
                    // Confirmed via direct test: "I need my windows looked
                    // at" produced obj:null even after the keyword-discard
                    // bug above was fixed, specifically because "windows" !=
                    // "window". Now checks the full, real synonym set for
                    // the matched keyword.
                    const kwSynonyms = new Set([kw]);
                    if (kw && window.DB?.intent_mappings?.objects) {
                        const mapping = window.DB.intent_mappings.objects.find(o => o.keyword === intentKeyword);
                        (mapping?.synonyms || []).forEach(s => { if (typeof s === 'string') kwSynonyms.add(s.toLowerCase()); });
                    }
                    const words = lower.split(/\s+/).filter(Boolean);
                    let objWords = [], inObj = false;
                    for (let i = 0; i < words.length; i++) {
                        const w = words[i];
                        // SSOT: stop at the next preposition OR relative-clause word
                        // (that/which/who/where...) once the noun phrase has started.
                        // Without the clause check, "the medallion THAT has separated
                        // from the ceiling" kept walking straight into the relative
                        // clause describing the object's condition, collecting words
                        // like "separated"/"now"/"wedged" instead of stopping at the
                        // actual noun ("medallion") — nlp_stop_words lists these same
                        // relative pronouns too, but only to SKIP them while continuing,
                        // never to end the phrase. This is a second, independent
                        // boundary set for that purpose (see nlp_clause_boundaries).
                        if ((PREPS.has(w) || CLAUSE.has(w)) && objWords.length > 0) break;
                        if (!w || w.length > 20) continue;
                        // v9.5 FIX (severe, previously-undiscovered, widespread
                        // bug): when the matched intent keyword IS the actual
                        // noun the customer typed ("fix my fridge" where
                        // kw="fridge"; "repair my window" where kw="window"),
                        // the old logic set inObj=true and unconditionally
                        // continued PAST pushing that exact word — discarding
                        // the one and only real candidate noun whenever it
                        // happened to be the keyword itself. Confirmed via
                        // direct test this affected every keyword-as-noun
                        // case (not just "window" — "fix my fridge" also
                        // produced obj:null). Fixed: a keyword match still
                        // triggers inObj, but the word itself now falls
                        // through to the same push logic every other in-
                        // phrase word gets (still correctly subject to
                        // SKIP-word filtering) rather than being
                        // unconditionally discarded.
                        if (isServiceVerb(w, VERBS)) { inObj = true; continue; }
                        if (kwSynonyms.has(w)) inObj = true;
                        if (!inObj || SKIP.has(w) || /^\d/.test(w) || /^\d+x\d+$/.test(w)) continue;
                        objWords.push(w);
                        // SSOT design note: collect the full pre-boundary run, then
                        // take the trailing slice below — not capped here. An English
                        // noun phrase's head noun sits at the end ("vintage brass coat
                        // RACK"), with descriptive adjectives piled up front; capping
                        // at the first 3 words reliably kept the adjectives and
                        // discarded the actual object.
                        if (objWords.length >= 8) break; // sane upper bound only
                    }
                    // Take the trailing 3 words of the collected run — closest to
                    // the boundary, i.e. the head noun's natural position.
                    objWords = objWords.slice(-3);
                    let obj = objWords.join(' ').trim();
                    if (obj.length >= 2) return obj;
                    // v9.5 FIX (PERMANENT fallback, not a patch): the forward
                    // walk above structurally cannot capture an object that
                    // appears BEFORE its verb ("a new door installed," "a
                    // deadbolt that needs installing") — inObj is never true
                    // until the verb is reached, by which point the real
                    // object words have already been passed over uncollected.
                    // Confirmed via direct trace this affected the
                    // object-based resolver whenever the customer's real,
                    // common, valid word order put the object first. Scan for
                    // the LAST recognized service verb in the sentence and
                    // collect backward from it until a stop-word boundary,
                    // reusing the same real SKIP-word filtering used forward.
                    let lastVerbIdx = -1;
                    for (let i = 0; i < words.length; i++) {
                        if (isServiceVerb(words[i], VERBS)) lastVerbIdx = i;
                    }
                    if (lastVerbIdx > 0) {
                        const backward = [];
                        for (let i = lastVerbIdx - 1; i >= 0; i--) {
                            const bw = words[i];
                            if (PREPS.has(bw) || CLAUSE.has(bw)) break;
                            if (SKIP.has(bw) || /^\d/.test(bw)) {
                                if (backward.length > 0) break; // stop once a real noun phrase has started
                                continue; // skip leading determiners/pronouns first
                            }
                            backward.unshift(bw);
                            if (backward.length >= 3) break;
                        }
                        obj = backward.join(' ').trim();
                        if (obj.length >= 2) return obj;
                    }
                    return null;
                }

// v9.4: these two module-scope constants were missing from the original
// extraction of this section — found by cross-testing extractQty against
// the real qr.html directly (the bug was masked in an earlier, narrower
// test because "install 3 outlets" matches extractQty's FIRST regex
// pattern and returns before ever reaching the code that needs these).
// Declared in qr.html immediately before extractQty, at the same module
// scope (not inside any function).
const _DIMENSION_PATTERN = /\b\d+\s*-?\s*(?:foot|feet|ft|inch|inches|in|cm|centimeters?|meters?|yards?|lbs?|pounds?|kg)\b/gi;
const _QTY_WORD_MAP = {one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10};

function extractQty(text) {
                    const patterns = [
                        /\b(\d+)\s*(tiles?|items?|pieces?|units?|doors?|fixtures?|signs?|shelves?|outlets?|switches?)/i,
                        /replace\s+(\d+)/i, /install\s+(\d+)/i, /fix\s+(\d+)/i
                    ];
                    for (const p of patterns) {
                        const m = text.match(p);
                        if (m) return Math.min(parseInt(m[1]), 99);
                    }
                    // SSOT: spelled-out number words ("Replace four panes") were never
                    // recognized here at all — only \d+ digit patterns — so a real
                    // multi-unit job silently defaulted to qty=1 and underbilled.
                    // (?!-) excludes a compound-adjective use ("four-poster bed"),
                    // same guard as the dimension check below.
                    for (const [w, n] of Object.entries(_QTY_WORD_MAP)) {
                        if (new RegExp('\\b' + w + '\\b(?!-)', 'i').test(text)) return n;
                    }
                    // Bare-digit fallback: strip dimension/measurement phrases first,
                    // so a leftover number is more likely to be a genuine count.
                    const stripped = text.replace(_DIMENSION_PATTERN, ' ');
                    const m = stripped.match(/\b(\d+)\b/);
                    return m ? Math.min(parseInt(m[1]), 99) : 1;
                }

function extractLocation(text) {
                    const SKIP = _SKIP_WORDS(), VERBS = _SVC_VERBS(), ROOMS = _ROOMS_LIST();
                    const lower = text.toLowerCase();
                    const m = lower.match(/\b(?:in|into)\s+(?:my|the|our|a)?\s*([a-z][a-z\s]{2,20})\b/);
                    if (!m) return null;
                    const loc = m[1].trim().replace(/\s+/g, ' ');
                    for (const room of ROOMS) { if (loc.startsWith(room) || loc === room) return room; }
                    const lw = loc.split(' ');
                    return (lw.length <= 3 && lw.every(w => w.length > 1)) ? loc : null;
                }

function extractSizeHint(text, tags) {
                    // Detect dimensions like 12x12, 6ft, 65 inch
                    const lower = text.toLowerCase();
                    const dimMatch = lower.match(/(\d+)\s*[x×]\s*(\d+)/);
                    if (dimMatch) {
                        const area = parseInt(dimMatch[1]) * parseInt(dimMatch[2]);
                        if (area > 600) return 'oversized';
                        if (area > 200) return 'large';
                        return 'standard'; // Means NOT oversized, NOT heavy
                    }
                    // "12 inch", "65 inch" TV → heavy/large
                    const inchMatch = lower.match(/(\d+)\s*(?:inch|in\b|")/);
                    if (inchMatch) {
                        const n = parseInt(inchMatch[1]);
                        if (n >= 65) return 'large'; // 65"+ TV → heavy_item candidate
                        if (n <= 24) return 'standard';
                    }
                    return null;
                }

function inferTagsFromContext(text, cat, groupId) {
                    // Infer tags from contextual hints in the text
                    const lower = text.toLowerCase();
                    const inferred = [];
                    // Fireplace / brick context
                    // v9.5 FIX (real, severe, live bug found via direct,
                    // specific pushback): this function never accepted or
                    // passed a real groupId to tagValidForCategory, so for
                    // ANY input, ever, the #brick_wall inference below was
                    // structurally dead — confirmed via direct trace that
                    // #brick_wall's own real applicable_group_ids data
                    // requires a real group match (added when
                    // tagValidForCategory's group-level check was correctly
                    // tightened in an earlier fix), but this function was
                    // never updated to thread the new, required parameter
                    // through. A genuinely real, working, intentional
                    // mechanism ("fireplace" -> #brick_wall) silently broken
                    // by an unrelated, later, correct fix elsewhere.
                    for (const hint of _BRICK_HINTS) {
                        if (lower.includes(hint) && tagValidForCategory('#brick_wall', cat, groupId)) {
                            inferred.push({
                                tid: '#brick_wall',
                                source: 'context'
                            });
                            break;
                        }
                    }
                    // High ceiling hints
                    // v9.5 FIX (same real bug class as #brick_wall above,
                    // found by checking the rest of this function): #high_ceiling
                    // also has real applicable_group_ids, so this call was
                    // equally, silently broken.
                    if (/(vaulted|cathedral|very high|high ceiling|12 ?ft|14 ?ft|tall ceiling)/i.test(text)) {
                        if (tagValidForCategory('#high_ceiling', cat, groupId)) inferred.push({
                            tid: '#high_ceiling',
                            source: 'context'
                        });
                    }
                    // Emergency
                    if (/(urgent|emergency|asap|today|right now|flooding|leak|critical)/i.test(text)) {
                        inferred.push({
                            tid: '#emergency',
                            source: 'context'
                        });
                    }
                    return inferred;
                }

function resolveGroupFromIntent(category, objectNoun, stype, fullText) {
                    if (!category || !DB?.group) return null;
                    const obj = (objectNoun || '').toLowerCase();
                    const groups = DB.group.filter(g => g.category_id === category);
                    if (!groups.length) return null;

                    // ── Cross-category override by object noun ─────────────────
                    // 'install' keyword maps to minor_home_repairs but some objects
                    // clearly belong in other categories — fan, router, thermostat etc.
                    const crossCategory = [
                        { keywords: ['fan','ceiling fan'], cat: 'electric_lighting', group: 'electric_lighting_fans' },
                        { keywords: ['light','fixture','chandelier','pendant','sconce'], cat: 'electric_lighting', group: 'electric_lighting_light_fixtures' },
                        { keywords: ['outlet','socket','gfci','usb outlet'], cat: 'electric_lighting', group: 'electric_lighting_outlets' },
                        { keywords: ['switch','dimmer'], cat: 'electric_lighting', group: 'electric_lighting_switches' },
                        { keywords: ['thermostat','nest','ecobee'], cat: 'electric_lighting', group: 'electric_lighting_thermostats' },
                        { keywords: ['router','wifi','extender','network'], cat: 'tech_trouble', group: 'tech_trouble_networking' },
                        { keywords: ['smart home','smart plug','smart speaker','alexa','google home'], cat: 'tech_trouble', group: 'tech_trouble_smart_home' },
                        { keywords: ['faucet','tap','sink'], cat: 'plumbing_help', group: 'plumbing_help_sinks' },
                        { keywords: ['toilet','bidet'], cat: 'plumbing_help', group: 'plumbing_help_toilets' },
                        { keywords: ['disposal','garbage disposal'], cat: 'plumbing_help', group: 'plumbing_help_garbage_disposals' },
                        { keywords: ['shower','tub','spout','showerhead','shower head','clog','clogged','drain'], cat: 'plumbing_help', group: 'plumbing_help_showers_tubs' },
                    ];
                    // v9.5 FIX: same real substring-collision class as
                    // detectIntentNLP's fix above — obj.includes(kw) let
                    // "washer" match inside "dishwasher". Word-boundary match
                    // instead.
                    const objWordBoundaryIncludes = (text, term) => {
                        if (!term) return false;
                        const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                        // v9.5 FIX (PERMANENT, not a patch): extends the
                        // original plural-only fix (s/es) to also handle verb
                        // conjugations (ed/ing) and the silent-e-drop pattern
                        // (replace->replacing) -- confirmed via direct test
                        // that "I need this installed" previously failed to
                        // match a bare "install" synonym, an ordinary phrasing
                        // gap affecting every verb synonym in the catalog, not
                        // just newly-added ones. Confirmed washer still
                        // correctly rejects dishwasher with this exact pattern.
                        const silentEDrop = term.endsWith('e') ? escaped.slice(0, -1) : null;
                        const altPattern = silentEDrop ? '|' + silentEDrop + '(?:ed|ing)' : '';
                        return new RegExp('\\b(?:' + escaped + "(?:'?s|es|ed|ing)?" + altPattern + ')\\b', 'i').test(text);
                    };
                    for (const cc of crossCategory) {
                        if (cc.keywords.some(kw => objWordBoundaryIncludes(obj, kw))) {
                            const ccGroup = (DB.group || []).find(g => g.id === cc.group);
                            if (ccGroup) return cc.group;
                        }
                    }

                    // ── Per-category routing rules ──────────────────────────────
                    const rules = {
                        wall_mounting: [
                            { keywords: ['tv','television','flatscreen','flat screen','monitor','screen','display'], group: 'wall_mounting_tv_flatscreen' },
                            { keywords: ['blind','curtain','drape','shade','roman shade'], group: 'wall_mounting_blinds_curtain' },
                            { keywords: ['brick','concrete','masonry','stone','cinder block'], group: 'wall_mounting_brick_or_concrete' },
                            { keywords: ['drywall','plaster','gypsum'], group: 'wall_mounting_drywall_or_plaster' },
                            // catch-all for wall_mounting: frames, shelves, signs, neon, art, etc.
                            { keywords: [], group: 'wall_mounting_frames_shelves', catchAll: true }
                        ],
                        minor_home_repairs: [
                            { keywords: ['washer','washing machine'], group: 'minor_home_repairs_appliances_washer' },
                            { keywords: ['dryer'], group: 'minor_home_repairs_appliances_dryer' },
                            // v9.5 FIX (closes backlog item U.1): microwave's
                            // rule moved BEFORE stove's, since "microwave" is
                            // the more specific term whenever a phrase
                            // mentions both (e.g. "microwave oven") --
                            // confirmed via direct test this previously,
                            // incorrectly resolved groupId to stove_range
                            // instead of the correct microwave group, since
                            // .some() short-circuits on the first array match
                            // and stove's broader "oven" keyword used to come
                            // first.
                            { keywords: ['microwave'], group: 'minor_home_repairs_appliances_microwave' },
                            { keywords: ['stove','oven','range','cooktop','burner'], group: 'minor_home_repairs_appliances_stove_range' },
                            { keywords: ['fridge','refrigerator','freezer','frig'], group: 'minor_home_repairs_appliances_refrigerator' },
                            { keywords: ['dishwasher'], group: 'minor_home_repairs_appliances_dishwasher' },
                            { keywords: ['window ac','air conditioner','ac unit','window unit'], group: 'minor_home_repairs_appliances_window_ac' },
                            { keywords: ['cabinet','drawer','cupboard','pantry','wardrobe','kitchen island','breakfast bar'], group: 'minor_home_repairs_cabinets_drawers' },
                            { keywords: ['door','hinge','knob','deadbolt','entry'], group: 'minor_home_repairs_doors' },
                            { keywords: ['floor','tile','baseboard','trim','molding','moulding','grout','hardwood'], group: 'minor_home_repairs_floors_trim' },
                            { keywords: ['chair','sofa','couch','desk','table','furniture','bed frame','dresser','headboard','footboard','four-poster'], group: 'minor_home_repairs_furniture' },
                            { keywords: ['wall','drywall','plaster','crack','hole','stucco','patch'], group: 'minor_home_repairs_walls' },
                            { keywords: ['window','sash','pane','screen','sill'], group: 'minor_home_repairs_windows' },
                            // Literal "appliance" mention only — NOT a real catch-all
                            // (no catchAll:true flag), unlike wall_mounting's genuine
                            // frames_shelves catch-all below. minor_home_repairs has
                            // no single group that's a sensible default for every
                            // unmatched object, so unmatched objects correctly fall
                            // through to resolveGroupFromIntent's `return null` —
                            // see that function's docstring/contract.
                            { keywords: ['appliance'], group: 'minor_home_repairs_appliances' }
                        ],
                        plumbing_help: [
                            { keywords: ['disposal','garbage disposal'], group: 'plumbing_help_garbage_disposals' },
                            { keywords: ['sink','faucet','tap','basin'], group: 'plumbing_help_sinks' },
                            { keywords: ['shower','tub','bath','spout','showerhead','shower head','clog','clogged','drain'], group: 'plumbing_help_showers_tubs' },
                            { keywords: ['toilet','commode','bidet'], group: 'plumbing_help_toilets' },
                            { keywords: ['water line','pipe','supply line'], group: 'plumbing_help_water_lines' }
                        ],
                        electric_lighting: [
                            { keywords: ['bulb','light bulb','lamp'], group: 'electric_lighting_bulbs' },
                            { keywords: ['fan','ceiling fan'], group: 'electric_lighting_fans' },
                            { keywords: ['fixture','light fixture','chandelier','pendant','sconce'], group: 'electric_lighting_light_fixtures' },
                            { keywords: ['outlet','plug','socket','gfci','usb outlet'], group: 'electric_lighting_outlets' },
                            { keywords: ['switch','dimmer','light switch'], group: 'electric_lighting_switches' },
                            { keywords: ['thermostat','nest','ecobee'], group: 'electric_lighting_thermostats' }
                        ],
                        tech_trouble: [
                            { keywords: ['computer','laptop','desktop','pc','mac','hard drive','virus','slow computer','backup','data backup'], group: 'tech_trouble_computer_repair' },
                            { keywords: ['cable','cord','wire','hdmi','power strip'], group: 'tech_trouble_cable_management' },
                            { keywords: ['wifi','router','network','internet','extender'], group: 'tech_trouble_networking' },
                            { keywords: ['smart home','alexa','google home','smart plug','smart switch','smart speaker'], group: 'tech_trouble_smart_home' }
                        ],
                        furniture_fixes_assembly: [
                            { keywords: [], group: 'furniture_fixes_assembly_assembly', stypes: ['Assembly'] },
                            { keywords: [], group: 'furniture_fixes_assembly_repair', stypes: ['Repair'] },
                            { keywords: [], group: 'furniture_fixes_assembly_disassembly', stypes: ['Disassembly'] }
                        ]
                    };

                    const catRules = rules[category];
                    // v9.5 FIX: was `return groups[0]?.id || null` — the exact same
                    // "guess the first group, regardless of semantic meaning" bug
                    // already found and fixed everywhere else in this function (see
                    // the contract note below at the real return-null fallback) —
                    // just reachable through a different door: a category with NO
                    // rules entry at all. Unreachable today (all 6 real categories
                    // have one), but a future 7th category added to the SSOT without
                    // a matching rules entry here would silently hit this exact bug
                    // again, contradicting this function's own documented contract.
                    if (!catRules) return null;

                    // Match object noun against keyword lists
                    for (const rule of catRules) {
                        if (rule.catchAll) continue; // skip catch-alls in first pass
                        // stype-only rules (furniture_fixes_assembly)
                        if (rule.stypes && !rule.keywords.length) {
                            if (stype && rule.stypes.some(st => stype.toLowerCase().includes(st.toLowerCase()))) {
                                if (groups.find(g => g.id === rule.group)) return rule.group;
                            }
                            continue;
                        }
                        if (rule.keywords.some(kw => objWordBoundaryIncludes(obj, kw))) {
                            if (groups.find(g => g.id === rule.group)) return rule.group;
                        }
                    }

                    // ── Full-sentence fallback pass ─────────────────────────────
                    // The object noun is a deliberately narrow ~3-word window
                    // (see extractObject) and sometimes the disambiguating word
                    // sits outside it — e.g. "install an acrylic sheet ... in my
                    // living room WINDOW" extracts object noun "acrylic sheet"
                    // correctly (sheet IS the object), but "window" — the thing
                    // that actually tells us which group this belongs in — is in
                    // a different clause describing where the object goes, not
                    // what it is. Before giving up, check the full original
                    // sentence (not just the narrow noun) against the same
                    // keyword rules. This only fires after the noun-only pass
                    // above has already failed, so a real noun match always
                    // wins outright over a coincidental whole-sentence mention.
                    if (fullText) {
                        const lowerFull = fullText.toLowerCase();
                        for (const rule of catRules) {
                            if (rule.catchAll || (rule.stypes && !rule.keywords.length)) continue;
                            if (rule.keywords.some(kw => objWordBoundaryIncludes(lowerFull, kw))) {
                                if (groups.find(g => g.id === rule.group)) return rule.group;
                            }
                        }
                    }

                    // Second pass: catch-alls
                    for (const rule of catRules) {
                        if (rule.catchAll && groups.find(g => g.id === rule.group)) return rule.group;
                    }

                    // SSOT: honor the documented contract above — "Returns null if
                    // no clear group can be determined" — rather than silently
                    // guessing groups[0] (whichever group happens to be listed
                    // first in btnyc.json's group[] array for this category, an
                    // accident of insertion order with zero semantic meaning).
                    // This was the actual root cause behind free-text jobs with
                    // a weak or failed object-noun extraction (no keyword in any
                    // rule matched) silently landing in "Appliances" every time,
                    // regardless of what the job actually was — Appliances simply
                    // happens to be minor_home_repairs' first-defined group. The
                    // caller already has a correct, designed-for-this fallback:
                    // when this returns null, it drops into the generic SmartQuote
                    // pipeline (sqPrepareFlow) instead of misrouting into a
                    // specific group's Other tile with confidently-wrong intake
                    // questions.
                    return null;
                }

function isServiceVerb(word, verbSet) {
                    if (!word) return false;
                    if (verbSet.has(word)) return true;
                    if (word.startsWith('re-') && word.length > 3) {
                        return verbSet.has('re' + word.slice(3));
                    }
                    return false;
                }
