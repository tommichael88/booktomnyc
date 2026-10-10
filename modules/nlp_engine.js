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
      *   the two retired preview action detectors (deleted in T155), a retired preview extractor,
      *   a retired preview extractor, a retired preview extractor, extractCondition. Powers the
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
      *   1), called directly from  sqAnalyze and other SmartQuote flow code.
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
      *      omitted it, causing a retired preview extractor to throw "ACTIONS is not
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
      * Deployment: loaded from modules/nlp_engine.js by qr.html, with a `src` script tag (a plain
      * global-scope script, not an ES module). This file IS the deployed artifact, not a copy of
      * anything in qr.html: edit it here, and publish it with qr.html (PENDING_DECISIONS #145 for
      * the order). `QR_BUILD_VERSION` below is the one value in it that must follow qr.html.
      */

     /*
      * ───────────────────── Historical trace-layer comments ─────────────────────
      * The following comments documented the trace layer that used to live inline
      * in this file. That code — every _trace* function, the
      * window._traceEnabled / _traceLog / _traceInput state, _simpleHash, the
      * flag/note/clear panel UI, and the global click/change listeners — now
      * lives in trace.js, loaded via <script src> immediately before the
      * pricing_engine.js block. The comments below are preserved verbatim for
      * historical reference only; they describe code that is no longer in this
      * file.
      *
      * The raw input (free text or a structured action list) that started the
      * current trace used to be stored in window._traceInput.
      *
      * v9.6 ADDITION: a manually-maintained build marker for qr.html itself.
      * A real, byte-for-byte hash of this file computed from WITHIN this
      * file's own running code isn't practically achievable (the file would
      * need to already be complete to hash it, but the hash would then need
      * to be embedded inside the not-yet-complete file -- a genuine
      * chicken-and-egg problem for a single, self-contained HTML file with
      * no separate build step). This is updated by hand alongside every real
      * change, in the same spirit as this project's own session-label
      * convention (T98, T99, ...) already used throughout TIMELINE.md.
      *
      * T109 FIX: confirmed via direct check of every TIMELINE.md entry's own
      * "Files modified" line that this value was left at 'T103' through five
      * real, subsequent qr.html edits (T104-T108) -- quietly wrong, not
      * caught by anything, for the exact reason a hand-maintained value
      * always eventually is. Guarded going forward by
      * test_harness/verify_qr_build_version_freshness.js, which fails loudly
      * (rather than staying quiet) the next time this drifts.
      *
      * T112 UPDATE: the freshness test did its job on the very next real
      * qr.html edit after it existed -- caught this value still reading
      * 'T109' after the detectIntentNLP cross-entry fix landed, exactly the
      * drift this test exists to catch. Bumped to 'T112'.
      *
      * T115 UPDATE: caught again, exactly as designed, after
      * the legacy curated-intake builder's confidence-formula fix. Bumped to 'T115'.
      * (T114 touched only btnyc.json, no qr.html edit, so no bump was due
      * between T112 and T115 -- confirmed by this test itself staying green
      * through that session.)
      *
      * T143/T144 UPDATE: the stop-the-line layer migration changed qr.html substantially across two ledger entries; this value follows the newest
      * (T144), which is what verify_qr_build_version_freshness.js reads from TIMELINE.md. Bumped to 'T144'. (Numbered T143/T144
      * because trace.js carries its own revisions T137-T142.)
      *
      * T145 UPDATE: answer chips work on every entry path (the route carries its context; orch_apply_answer). Bumped to 'T145'.
      *
      * T146 UPDATE: a tag is worth the same on every entry path (synthesizeAnswersFromTags shared; the orchestrator's chargeability gate). Bumped to 'T146'.
      *
      * T147 UPDATE: quantity is decided in ONE resolver pair that names its source (resolveQuantityUnits / resolveQuantityMultiplier; eight arbiter sites retired); the overflow formula carries the flat top-band price; the strategy and follow-up ceiling resolvers name their source. Bumped to 'T147'.
      *
      * T148 UPDATE: the strategy resolver returns a literal `source` plus per-field `fieldSources`; the renderer is handed the SSOT copy it needs (divergenceTerms, dispatchScopeNote) instead of reading the SSOT; the route carries basePrice; resolveBuilderQuantity replaces Glue's direct lookup. Bumped to 'T148'.
      *
      * T149 UPDATE: eight readers that still fell back to the retired flat legacy shape (`|| svc.base_price`, `|| svc.display_name`, `|| svc.estimate_disclaimer`, `|| svc.group_id`, `|| s.group_id || s.group`) were deleted after the running page proved no entity carries a flat field (verify_entity_shape_single.js). Behavior-neutral: 836 renders and 1380 price points unchanged. Bumped to 'T149'.
      *
      * T150 UPDATE: ONE checkout-state resolver. resolveServiceCheckoutStateKey returns { key, source } (the Charter's vocabulary); every reader asks it and none reads financial_engine.checkout_state itself, so the card-tap path and the route path now agree on which services self-quote (two did not: LED bulb upgrade, standard shelf mounting). resolveCheckoutState, which never resolved anything, is buildCheckoutStateModel. A write-only checkoutState thread (four writers, no live reader) and the unreachable operands chained after the resolver are deleted. Bumped to 'T150'.
      *
      * T151 UPDATE: one shared isQuantityFixed (card tap and route); the pure-quantity template rule requires it (shelf mounting no longer self-quotes); an unknown template-matrix condition fails closed; the flat-checkout names live in the SSOT (isFlatCheckoutState). Bumped to 'T151'.
      *
      * T152 UPDATE (dumb-UI render targets): the route card, the browse tiles, the intake views and the cart panel each own ONE host and no host is nested inside another. The cart panel used to be nested inside #intakeQuestionsContainer inside #serviceContainer, so renderRoute's innerHTML = '' destroyed it and the affirmation / self-quote renderers returned silently (the search flow was dead for most requests, in the original file too). Bumped to 'T152'.
      *
      * T153 UPDATE: a price that scales with quantity now comes with a way to enter it. The curated card draws a - / + control for a numeric quantity module (route.quantity.stance === 'batched'); orch_apply_quantity (Logic) re-runs the workflow with the new number and handleIntakeQuantity (Glue) dispatches. Ten services quoted a quantity-scaled price with no way to enter the quantity. Bumped to 'T153'.
      */

     // QR_BUILD_VERSION stays live in THIS file, not trace.js: the component-layer
     // test harness extracts this const from qr.html directly, and the freshness
     // guard (test_harness/verify_qr_build_version_freshness.js) reads it here.
     // Bump it by hand alongside every real qr.html edit.
     const QR_BUILD_VERSION = 'T164';

     /*
      * ───────────────────── Historical _simpleHash comment ─────────────────────
      * The live _simpleHash now lives in trace.js. Preserved verbatim below for
      * historical reference only:
      *
      * A simple, fast, synchronous string hash (djb2) -- not cryptographic,
      * deliberately: the real, stated purpose here is "are we looking at the
      * same btnyc.json", not tamper-proofing, so a fast, dependency-free,
      * synchronous hash is the right tool. crypto.subtle.digest exists in
      * -browser but is Promise-based, which would force every trace call
      * site to become async for no real benefit here.
      *
     function _simpleHash(str) {
         let h = 5381;
         for (let i = 0; i < str.length; i++) {
             h = ((h << 5) + h + str.charCodeAt(i)) | 0; // h*33 + c
         }
         return (h >>> 0).toString(16).padStart(8, '0');
     }
      */

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
             (def.all_forms || []).forEach(f => {
                 map[f.toLowerCase()] = defaultInf;
             });
             (def.synonym_clusters || []).forEach(cluster => {
                 (cluster.forms || []).forEach(f => {
                     map[f.toLowerCase()] = cluster.infinitive;
                 });
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
                 serviceTypeKey: key, // e.g. 'Repair' — maps to service_types
                 infinitive: def.infinitive_for_adlib || key.toLowerCase(),
                 wordInfinitiveMap: buildWordMap(def), // word-level echo-back
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
                 serviceTypeKey: null,
                 infinitive: def.infinitive_for_adlib || key,
                 wordInfinitiveMap: buildWordMap(def),
                 pattern,
                 _extraKey: key
             });
         }

         window._NLP = {
             STOP: new Set(nl.nlp_stop_words || []),
             PREPS: new Set(nl.nlp_stop_preps || []),
             CLAUSE: new Set(nl.nlp_clause_boundaries || []),
             VERBS: new Set(nl.nlp_service_verbs || []),
             ROOMS: nl.nlp_location_words || [],
             APPLIANCES: nl.nlp_location_appliance_map || {}, // T118 (#19)
             CONDS: nl.nlp_condition_phrases || [],
             VMAP: nl.nlp_verb_past_map || {},
             NEG: new Set(nl.negative_words || []),
             ACTIONS, // NEW: SSOT action matcher
             understand: (t, o) => understandRequest(t, o), // T136: the ONE parse
             // v9.6 FIX: extractObject/extractQty/extractLocation were never
             // exposed here, so UIRenderer.js's live-preview pipeline
             // maintained its own, entirely separate implementations rather
             // than sharing these -- confirmed via direct diff they had
             // genuinely diverged (UIRenderer's extractObject was a completely
             // different, independently-evolved algorithm, not a stale copy of
             // the same one). Exposed now so there is exactly one real
             // implementation of each, consumed by both the preview and
             // analysis pipelines, matching this project's SSOT/single-
             // determination principle rather than two engines that can
             // silently disagree.
             extractObject,
             extractQty,
             extractLocation
         };
         // Compatibility: expose as top-level window properties so cms_bridge.js,
         // test harnesses, and any code that reads ACTIONS / SERVICE_VERBS etc.
         // directly (rather than via window._NLP) continues to work.
         window.ACTIONS = ACTIONS;
         window.SERVICE_VERBS = window._NLP.VERBS;
         window.STOP_PREPS = window._NLP.PREPS;
         window.VERB_PAST_MAP = window._NLP.VMAP;
         window.ROOMS = window._NLP.ROOMS;
         window.CONDITIONS = window._NLP.CONDS;
     }

     // Lazy accessors used by the ANALYSIS pipeline to read the shared word sets.
     const _SKIP_WORDS = () => window._NLP?.STOP || new Set();
     const _SVC_VERBS = () => window._NLP?.VERBS || new Set();
     const _STOP_PREPS = () => window._NLP?.PREPS || new Set();
     const _CLAUSE_BOUNDARY = () => window._NLP?.CLAUSE || new Set();
     const _ROOMS_LIST = () => window._NLP?.ROOMS || [];

     // ───────────────────────── PREVIEW pipeline ─────────────────────────

     // v9.4: in qr.html, this destructuring is a one-time top-level statement in
     // the SAME script block as the preview-pipeline functions below, executed
     // once when that block loads (after initNlpSets() has already run earlier
     // in the page). Wrapped here in a named function so this standalone module
     // has an explicit call instead of relying on top-level execution order.
     let STOP_WORDS, STOP_PREPS, SERVICE_VERBS, ROOMS, CONDITIONS, VERB_PAST_MAP, ACTIONS, QTY_WORDS;

     function refreshNlpPreviewBindings() {
         ({
             STOP: STOP_WORDS,
             PREPS: STOP_PREPS,
             VERBS: SERVICE_VERBS,
             ROOMS,
             CONDS: CONDITIONS,
             VMAP: VERB_PAST_MAP,
             ACTIONS
         } = window._NLP || {});
         QTY_WORDS = new Set(['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten']);
     }

     // ═══════════════════════════════════════════════════════════════════
     // T136 -- THE ONE CANONICAL UNDERSTANDING OF A TYPED REQUEST.
     //
     // Charter (Gateway B, Convergence): the live preview, the confirm
     // button and the estimate must all come from the SAME parse. Before
     // this, five places parsed one sentence five different ways
     // (buildPreview x2, estimateLiveConfidence x2, and the estimate path):
     // the preview said "I need to fix" while the estimate matched
     // "window" at 75, and the extractor invented nouns ("ass off tried")
     // from whatever words trailed a verb.
     //
     // Rules this function enforces:
     //  - An object noun must be a plausible noun phrase (no particles,
     //    prepositions, verb forms, negations) -- otherwise it is NOT
     //    shown; the slot stays empty so the client is asked.
     //  - Clauses are respected: a noun never spans a sentence boundary.
     //  - Conditions ("broken", "cracked") are facts, not sentence
     //    vocabulary (Charter: the sentence names slots, never chips or
     //    condition clauses), so they are never composed into the preview.
     //  - "Complete" (the green "Looks right" state) requires a valid
     //    object AND the orchestrator's own SSOT confidence bar. No
     //    threshold literals live in code.
     // ═══════════════════════════════════════════════════════════════════
     let _nlpQuiet = false;
     let _vocabCache = null,
         _vocabDB = null;

     function _resolutionThresholds() {
         const t = window.DB?.workflow?.resolution_thresholds;
         if (t && typeof t.route_to_group_other_tile === 'number' && typeof t.auto_select_named_service === 'number') return t;
         if (typeof console !== 'undefined') console.error('SSOT workflow.resolution_thresholds is missing -- failing closed (nothing will read as confident).');
         return {
             auto_select_named_service: Infinity,
             route_to_group_other_tile: Infinity
         };
     }

     function _vocab() {
         const DB = window.DB;
         if (_vocabCache && _vocabDB === DB) return _vocabCache;
         const heads = [],
             words = new Set();
         const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
         for (const m of (DB?.intent_mappings?.objects || [])) {
             const isObj = m.is_object !== false;
             const phrases = new Set([m.keyword, ...(m.synonyms || [])]
                 .filter(s => typeof s === 'string').map(s => s.toLowerCase().trim()).filter(Boolean));
             for (const p of phrases) {
                 p.split(/\s+/).forEach(w => words.add(w));
                 if (isObj) heads.push({
                     phrase: p,
                     keyword: m.keyword,
                     re: new RegExp('(?<![a-z])' + esc(p) + "(?:'?s|es)?(?![a-z])", 'gi')
                 });
             }
         }
         for (const s of (DB?.services || []))
             for (const a of (s.aliases || []))
                 if (typeof a === 'string') a.toLowerCase().split(/\s+/).forEach(w => w && words.add(w));
         heads.sort((a, b) => b.phrase.length - a.phrase.length);
         _vocabCache = {
             heads,
             words
         };
         _vocabDB = DB;
         return _vocabCache;
     }

     // Is this word (or its singular) a word the SSOT vocabulary knows? Tries the plain
     // word, then -s ("tiles" -> "tile"), then -es ("boxes" -> "box").
     function _inVocab(w, vocab) {
         if (vocab.words.has(w)) return true;
         if (/s$/.test(w) && vocab.words.has(w.slice(0, -1))) return true;
         if (/es$/.test(w) && vocab.words.has(w.slice(0, -2))) return true;
         return false;
     }

     function _tokenSets() {
         const nl = window.DB?.negation_library || {};
         const cond = new Set();
         for (const [p] of (window._NLP?.CONDS || []))
             String(p).toLowerCase().replace(/\u2019/g, "'").split(/\s+/).forEach(w => w && cond.add(w));
         return {
             STOP: _SKIP_WORDS(),
             PREPS: _STOP_PREPS(),
             CLAUSE: _CLAUSE_BOUNDARY(),
             VERBS: _SVC_VERBS(),
             PARTICLES: new Set(nl.nlp_particle_words || []),
             ACTION_NOUNS: new Set(nl.nlp_action_nouns || []),
             COND: cond,
             ROOMS: new Set((_ROOMS_LIST() || []).map(r => r.toLowerCase())),
         };
     }

     // A token that can never sit INSIDE a client's noun phrase.
     function _isHardNonNoun(w, T, vocab) {
         if (T.PREPS.has(w) || T.CLAUSE.has(w) || T.PARTICLES.has(w)) return true;
         if (T.VERBS.has(w) || isServiceVerb(w, T.VERBS)) return true;
         if (/['\u2019]/.test(w) || /\d/.test(w)) return true;
         // verb/participle forms ("tried", "pulling") are not nouns unless
         // the SSOT itself uses the word as a noun ("ceiling", "bed").
         if (/(?:ed|ing)$/.test(w) && w.length >= 5 && !vocab.words.has(w)) return true;
         return false;
     }

     // Edge words that are facts about the job, not part of the object.
     function _isEdgeTrim(w, T) {
         return T.COND.has(w) || T.ROOMS.has(w) || _QTY_WORD_MAP[w] != null || T.STOP.has(w) || T.ACTION_NOUNS.has(w);
     }

     function _validateNounPhrase(raw, vocab) {
         if (!raw) return null;
         const T = _tokenSets();
         let toks = String(raw).toLowerCase().split(/\s+/).filter(Boolean);
         while (toks.length && _isEdgeTrim(toks[0], T)) toks.shift();
         while (toks.length && _isEdgeTrim(toks[toks.length - 1], T)) toks.pop();
         if (!toks.length || toks.length > 3) return null;
         for (const w of toks) {
             if (_isHardNonNoun(w, T, vocab)) return null;
             if (T.COND.has(w) || T.STOP.has(w)) return null; // interior condition/stop word => not one noun phrase
         }
         const noun = toks.join(' ');
         if (noun.length < 2) return null;
         return {
             noun,
             grounded: toks.some(w => vocab.words.has(w))
         };
     }

     // Grounded fallback: find the SSOT object vocabulary in the text and
     // build the noun phrase around it. Occurrences inside a prepositional
     // phrase ("on a DRYWALL wall") are surfaces/locations, not the object.
     function _groundedObjectPhrase(lower, intentKeyword, vocab) {
         const T = _tokenSets();
         const toks = [];
         const tre = /[a-z0-9'\u2019-]+/g;
         let tm;
         while ((tm = tre.exec(lower))) toks.push({
             w: tm[0].replace(/\u2019/g, "'"),
             s: tm.index,
             e: tm.index + tm[0].length
         });
         let best = null,
             bestPP = null;
         for (const h of vocab.heads) {
             h.re.lastIndex = 0;
             let m;
             while ((m = h.re.exec(lower))) {
                 const s = m.index,
                     e = m.index + m[0].length;
                 const first = toks.findIndex(t => t.e > s && t.s < e);
                 if (first < 0) continue;
                 let last = first;
                 while (last + 1 < toks.length && toks[last + 1].s < e) last++;
                 // Is this head inside a prepositional phrase? Walk back over the whole
                 // noun phrase (determiners, modifiers, compound-noun parts) to the word
                 // that governs it: a preposition => it is a surface/location, a verb or
                 // clause boundary => it is a direct object.
                 let inPP = false;
                 for (let p = first - 1, hops = 0; p >= 0 && hops < 4; p--, hops++) {
                     const pw = toks[p].w;
                     if (T.PREPS.has(pw)) {
                         inPP = true;
                         break;
                     }
                     if (T.STOP.has(pw)) continue;
                     if (_isHardNonNoun(pw, T, vocab) || T.CLAUSE.has(pw)) break;
                 }
                 const cand = {
                     first,
                     last,
                     pref: (intentKeyword && h.keyword === intentKeyword) ? 1 : 0,
                     len: e - s,
                     s
                 };
                 const better = (a, b) => !b || a.pref > b.pref || (a.pref === b.pref && a.len > b.len) ||
                     (a.pref === b.pref && a.len === b.len && a.s < b.s);
                 // non-PP heads always outrank PP ones; a PP head is still the answer when
                 // it is the ONLY thing named ("a hole in my drywall")
                 if (inPP) {
                     if (better(cand, bestPP)) bestPP = cand;
                 } else if (better(cand, best)) best = cand;
             }
         }
         best = best || bestPP;
         if (!best) return null;
         const mods = [];
         for (let i = best.first - 1; i >= 0 && mods.length < 2; i--) {
             const w = toks[i].w;
             if (_isHardNonNoun(w, T, vocab) || T.STOP.has(w) || T.COND.has(w) || T.ROOMS.has(w) || _QTY_WORD_MAP[w] != null) break;
             mods.unshift(w);
         }
         const headWords = toks.slice(best.first, best.last + 1).map(t => t.w);
         let after = null;
         const nx = toks[best.last + 1];
         // a following word extends the noun only if it can be a noun: verb-like
         // 3rd-person forms ("keeps", "runs", "leaks") are not, unless the SSOT
         // itself uses the stem as a noun ("pulls" -> "pull").
         const verbLikeS = /[^s]s$/.test(nx ? nx.w : '') && !_inVocab(nx ? nx.w : '', vocab);
         if (nx && !verbLikeS && !_isHardNonNoun(nx.w, T, vocab) && !T.STOP.has(nx.w) && !T.COND.has(nx.w) && !T.ROOMS.has(nx.w) && _QTY_WORD_MAP[nx.w] == null) after = nx.w;
         const phrase = [...mods, ...headWords, ...(after ? [after] : [])].join(' ');
         return {
             noun: phrase,
             grounded: true
         };
     }

     function extractObjectDetailed(text, intentKeyword) {
         const vocab = _vocab();
         // "55 inch tv": the size is a fact about the item, not part of its noun
         const src = String(text || '').replace(_DIMENSION_PATTERN, ' ');
         // Clause-aware: never let a noun run across a sentence/clause boundary.
         const clauses = src.split(/[.!?;,\n]+|\b(?:and|but|so|because|since|when|while|then|although|though)\b/i)
             .map(c => c.trim()).filter(Boolean);
         // Pass 1: the SSOT's own vocabulary, anywhere in the text (occurrences
         // inside a prepositional phrase are surfaces/locations, skipped).
         const g = _groundedObjectPhrase(src.toLowerCase().replace(/[.,!?;:]/g, ' '), intentKeyword, vocab);
         if (g) return g;
         // Pass 2: a verb-anchored noun phrase per clause, first VALID one wins.
         for (const clause of (clauses.length ? clauses : [src])) {
             const v = _validateNounPhrase(_extractObjectRaw(clause, intentKeyword), vocab);
             if (v) return v;
         }
         return {
             noun: null,
             grounded: false
         };
     }

     function extractObject(text, intentKeyword) {
         return extractObjectDetailed(text, intentKeyword).noun;
     }

     // All recognised actions in the order the client said them (max 2),
     // as natural infinitives -- "repair and hang", never just the one the
     // table happens to list first.
     function detectActionsInOrder(text) {
         const l = String(text || '').toLowerCase().replace(/\u2019/g, "'");
         const acts = window._NLP?.ACTIONS || [];
         const found = [];
         for (const a of acts) {
             const re = new RegExp(a.pattern.source, 'gi');
             let m;
             while ((m = re.exec(l))) {
                 const word = (m[1] || m[0]).toLowerCase();
                 const inf = (a.wordInfinitiveMap && a.wordInfinitiveMap[word]) || a.infinitive;
                 if (inf) found.push({
                     inf,
                     idx: m.index
                 });
                 if (m[0].length === 0) re.lastIndex++;
             }
         }
         found.sort((x, y) => x.idx - y.idx);
         const out = [];
         for (const f of found)
             if (!out.includes(f.inf)) out.push(f.inf);
         if (out.length) return out.slice(0, 2);
         // no verb: a stated malfunction still implies "fix"
         if (/\b(can't|cant|won't|wont|doesn't|doesnt)\b/.test(l) || /\b(unclog|unclogging|unblock|drain)\b/.test(l)) return ['fix'];
         if ((window._NLP?.CONDS || []).some(([pattern]) => l.includes(pattern))) return ['fix'];
         return [];
     }

     // Clients paste and autocorrect: "Wi‑Fi" (non-breaking hyphen), curly quotes,
     // non-breaking spaces. Normalise once so vocabulary matching never misses on
     // typography.
     function _normalizeTypedText(t) {
         return String(t == null ? '' : t)
             .replace(/[\u2010-\u2015\u2212]/g, '-')
             .replace(/[\u2018\u2019\u201B]/g, "'")
             .replace(/[\u201C\u201D]/g, '"')
             .replace(/[\u00A0\u2007\u202F]/g, ' ');
     }

     // The ONE composer of the request sentence -- typed-text preview, builder
     // close-sync and builder finish all call it (they used to carry three private
     // string templates). Pure. `condition` is only ever passed when the CLIENT
     // chose it explicitly in the builder; NLP never puts condition clauses into a
     // sentence (Charter: the sentence names slots, not tags).
     function composeAdlibParts(slots, opts) {
         const cfg = window.DB?.adlib_phrase_overrides?.adlib || {};
         const start = cfg.sentence_start || 'I need';
         const locPrefix = cfg.location_prefix || 'in my';
         const acts = (slots.actions || []).filter(Boolean);
         const object = slots.object || null,
             subject = slots.subject || null;
         const qty = slots.qty > 1 ? slots.qty : 1;
         const filled = !!(object || subject);
         const parts = [{
             text: acts.length ? start + ' to ' + acts.join(' and ') : (cfg.no_action_frame || start)
         }];
         if (object) parts.push({
             text: ' my ' + (qty > 1 ? qty + ' ' : '') + object
         });
         else if (subject) parts.push({
             text: ' ' + subject
         });
         else if (opts && opts.ghost) {
             parts.push({
                 text: ' my '
             });
             parts.push({
                 ghost: (cfg.slot_prompts || {}).object || 'what item?'
             });
         }
         if (slots.condition && filled) {
             const clauseStyle = /^(can't|cant|won't|wont|doesn't|doesnt|cannot)\b/i.test(slots.condition);
             parts.push({
                 text: (clauseStyle ? ' because it ' : ' because it is ') + slots.condition
             });
         }
         if (slots.location && filled) parts.push({
             text: ' ' + locPrefix + ' ' + slots.location
         });
         return parts;
     }

     function composeAdlibSentence(slots) {
         return composeAdlibParts(slots).map(p => p.text || '').join('').trim();
     }

     function understandRequest(text, opts) {
         const src = _normalizeTypedText(text);
         const hasText = !!src.trim();
         const empty = {
             hasText,
             text: '',
             parts: [],
             actions: [],
             object: null,
             subject: null,
             resolutionObject: null,
             objectGrounded: false,
             qty: 1,
             location: null,
             intent: null,
             confidence: 0,
             complete: false,
             missing: hasText ? ['object'] : ['object', 'action']
         };
         if (!hasText || !window.DB) return empty;

         const wasQuiet = _nlpQuiet;
         _nlpQuiet = !!(opts && opts.quiet);
         let intent = null;
         try {
             intent = detectIntentNLP(src);
         } finally {
             _nlpQuiet = wasQuiet;
         }
         const kw = intent && intent.key && intent.key !== 'other' ? intent.key : null;
         const obj = extractObjectDetailed(src, kw);
         // Resolvers (group/service matching) keep the lenient phrase they always
         // got -- it may contain action nouns ("crack repair") that help match a
         // service. It is NEVER shown to a client.
         let resolutionObject = _extractObjectRaw(src, kw);
         // ...but junk never feeds routing: a phrase carrying a particle ("off") or a
         // verb form ("tried") is not a noun phrase ("ass off tried" in the operator's
         // trace). It is dropped and routing falls back to the grounded noun.
         if (resolutionObject && obj.noun) {
             const _T = _tokenSets(),
                 _V = _vocab();
             if (resolutionObject.toLowerCase().split(/\s+/).some(w => _T.PARTICLES.has(w) || (/(?:ed|ing)$/.test(w) && w.length >= 5 && !_inVocab(w, _V)))) resolutionObject = null;
         }
         const actions = detectActionsInOrder(src);
         // An ungrounded noun is only credible when the client also said what
         // they want done to it ("hang my clock"); a bare fragment is not.
         const object = (obj.noun && (obj.grounded || actions.length)) ? obj.noun : null;
         // Some SSOT keywords name the whole job rather than an item ("slow drain",
         // "virus", "furniture assembly": is_object:false + names_the_job:true).
         // They are a complete subject by themselves -- no item slot to ask for.
         const _map = kw ? (window.DB.intent_mappings?.objects || []).find(o => o.keyword === kw) : null;
         const subject = (!object && _map && _map.names_the_job) ? (_map.subject_phrase || _map.keyword) : null;
         const qty = extractQty(src) || 1;
         let location = extractLocation(src);
         if (location && object && object.toLowerCase().includes(String(location).toLowerCase())) location = null;
         // Charter Safety Net: one object keyword is one weak signal. A DEFAULT
         // service (default_service_sku) may auto-commit only if nothing the
         // client said contradicts it. A compound noun whose head word the SSOT
         // doesn't know ("toilet LID": not a flapper) is such a contradiction --
         // withhold the SKU so the request routes to its group instead of
         // committing to the wrong scope.
         if (intent && intent.recommendedSku && !intent._hadContextualOverride && !intent._descriptionOverride && obj.noun) {
             const voc = _vocab();
             const inVoc = w => _inVocab(w, voc);
             const toks = obj.noun.toLowerCase().split(/\s+/);
             let lastKnown = -1;
             toks.forEach((w, i) => {
                 if (inVoc(w)) lastKnown = i;
             });
             const AN = _tokenSets().ACTION_NOUNS;
             // A trailing word is EXPLAINED if the recommended service itself uses it
             // ("router CONFIGURATION", "toilet FLAPPER"): it names the very service being
             // recommended, so it corroborates the match instead of contradicting it. Only
             // words the service does not account for ("toilet LID" vs a flapper repair)
             // are contradictions.
             const _svc = (window.DB.services || []).find(x => x.id === intent.recommendedSku);
             const svcWords = new Set();
             if (_svc) {
                 const addWords = t => String(t || '').toLowerCase().split(/[^a-z0-9]+/).forEach(w => w && svcWords.add(w));
                 addWords(_svc.id);
                 addWords(_svc.ui_taxonomy && _svc.ui_taxonomy.display_name);
                 (_svc.aliases || []).forEach(addWords);
             }
             const inSvc = w => svcWords.has(w) || (/s$/.test(w) && svcWords.has(w.slice(0, -1)));
             const trailing = lastKnown >= 0 ? toks.slice(lastKnown + 1).filter(w => !inVoc(w) && !AN.has(w) && !inSvc(w)) : [];
             if (trailing.length) {
                 intent = Object.assign({}, intent, {
                     recommendedSku: null,
                     _recommendedSkuWithheld: 'unexplained_noun:' + trailing.join(' ')
                 });
             }
         }
         const confidence = intent?._matchConfidence ?? 0;
         const bar = _resolutionThresholds().route_to_group_other_tile;
         const complete = !!(object || subject) && confidence >= bar;

         const parts = composeAdlibParts({
             actions,
             object,
             subject,
             qty,
             location
         }, {
             ghost: true
         });
         return {
             hasText,
             text: parts.map(p => p.text || '').join('').trim(),
             parts,
             actions,
             object,
             subject,
             resolutionObject,
             objectGrounded: !!(obj.noun && obj.grounded),
             qty,
             location,
             intent,
             confidence,
             complete,
             missing: (object || subject) ? [] : ['object']
         };
     }

     // v9.6 FIX: a retired preview extractor removed -- confirmed zero real call
     // sites; buildPreview (the real, live preview renderer) has always
     // called the bare-named extractObject, never this. Fully orphaned
     // since before this session, unrelated to the extractObject
     // consolidation (COMPONENT_LAYER_MAP.md).

     // v9.6 FIX: a retired preview extractor removed -- same finding as
     // a retired preview extractor above: confirmed zero real call sites,
     // buildPreview calls the bare-named extractQty instead
     // (COMPONENT_LAYER_MAP.md).

     // v9.6 FIX: a retired preview extractor removed -- same finding as the two
     // above: confirmed zero real call sites, buildPreview calls the
     // bare-named extractLocation instead (COMPONENT_LAYER_MAP.md).

     function extractCondition(text) {
         const l = text.toLowerCase().replace(/\u2019/g, "'");
         for (const [pattern, display] of CONDITIONS) {
             if (l.includes(pattern)) return display;
         }
         return null;
     }

     // ───────────────────────── ANALYSIS pipeline ─────────────────────────

     function detectIntentNLP(text) {
         // T118 #30 FIX (PENDING_DECISIONS.md #30): real, user-captured
         // trace -- "I need a bed assembled. [...] produces irrelevant
         // questions like Drywall or plaster..." matched "plaster", a
         // word appearing only in the customer's OWN parenthetical
         // complaint about the app, and routed the entire quote to
         // brick_or_concrete_crack_repair instead of furniture
         // assembly. Two changes, both applied before any scoring:
         // (1) strip quoted/parenthetical/bracketed spans entirely --
         // this is where incidental complaints/asides/meta-commentary
         // live, not the customer's actual stated need; (2) compute
         // primaryRegionEnd, the character offset ending the first
         // ~15 words of what remains, so the scoring loop below can
         // weight matches found only beyond it. Both are deliberately
         // narrow, additive preprocessing steps -- the scoring loop
         // itself, and everything after it (cross-entry specificity,
         // resolver precedence, etc.), is unchanged in structure,
         // only in the weight each match contributes and in whether
         // the FINAL winner may carry a recommendedSku. See the
         // weight application (search "positionWeight") and the
         // recommendedSku suppression at this function's return for
         // the other two pieces.
         const _stripped = (text || '').replace(/\([^)]*\)/g, ' ').replace(/\[[^\]]*\]/g, ' ').replace(/"[^"]*"/g, ' ').replace(/'[^']*'/g, ' ');
         const _primaryWordMatch = _stripped.trim().match(/^(?:\S+\s+){0,14}\S+/);
         const primaryRegionEnd = _primaryWordMatch ? _primaryWordMatch[0].length : _stripped.length;
         const matchesInRegion = (fullText, term, endIndex) => {
             if (!term) return false;
             const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
             const silentEDrop = term.endsWith('e') ? escaped.slice(0, -1) : null;
             const altPattern = silentEDrop ? '|' + silentEDrop + '(?:ed|ing)' : '';
             const re = new RegExp('\\b(?:' + escaped + "(?:'?s|es|ed|ing)?" + altPattern + ')\\b', 'i');
             const m = re.exec(fullText);
             return !!(m && m.index < endIndex);
         };
         const lower = _stripped.toLowerCase();
         let maps = DB.intent_mappings || [];
         if (!Array.isArray(maps) && maps.objects) maps = maps.objects;
         const normStype = s => (window._normServiceType ? window._normServiceType(s) : (s || 'Repair').replace('Install / Mount', 'Install').replace('Install/Mount', 'Install'));

         let best = null,
             top = 0,
             bestMapping = null,
             bestMatchedFromPrimary = false;
         // T112 FIX (PENDING_DECISIONS #37): pure extraction, zero
         // behavior change -- factored out so the new cross-entry
         // specificity check below (after the main loop) can build
         // a candidate object from a DIFFERENT entry using the
         // exact same shape/logic as the main loop always has,
         // with no risk of the two object literals drifting apart.
         const buildCandidate = (m, score) => ({
             category: m.default_dynamic_category || m.fallback?.category || 'other',
             stype: normStype(m.default_service_type || m.fallback?.service_type || 'Repair'),
             group: m.keyword,
             base: m.fallback?.base_price || FALLBACKS.base_price,
             key: m.keyword,
             label: m.keyword,
             qtyLabel: 'item',
             resolver: m.resolver || null,
             recommendedSku: m.default_service_sku || null,
             _matchConfidence: score,
             dynamic_rule: m.dynamic_rule || null,
             _ctxFee: 0,
             _ctxMin: 0,
             _ctxTags: []
         });
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
             // T118 #30 FIX: a match found only beyond the first ~15
             // words scores at half weight, same reduction factor
             // already established for generic (non-full-weight)
             // synonyms above -- reusing a familiar number rather
             // than inventing a new one. kwInPrimary tracks whether
             // THIS specific match is strong (primary) or incidental,
             // for the recommendedSku gate at the return.
             const kwInPrimary = kwMatched && matchesInRegion(lower, kw, primaryRegionEnd);
             let matchedFromPrimary = false;
             if (kwMatched) {
                 score += kwInPrimary ? w : w * .5;
                 matchedFromPrimary = matchedFromPrimary || kwInPrimary;
             }
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
                     if (wordBoundaryIncludes(lower, sl)) {
                         // v9.6: an explicit, per-entry, verified-safe
                         // opt-in list of synonyms that are genuinely
                         // as specific/unambiguous as the primary
                         // keyword (e.g. "sink" for "faucet" -- same
                         // category, no cross-category collision,
                         // checked directly) -- these earn the full
                         // weight too, not the generic half-weight
                         // every other synonym gets.
                         const isFullWeight = Array.isArray(m.full_weight_synonyms) && m.full_weight_synonyms.includes(sl);
                         // T118 #30 FIX: same position weighting as
                         // the primary keyword match above, compounded
                         // with (not replacing) the existing full/half
                         // -weight synonym distinction -- a
                         // full-weight synonym found only in the
                         // incidental region still scores lower than
                         // one found in the primary region.
                         const synInPrimary = matchesInRegion(lower, sl, primaryRegionEnd);
                         matchedFromPrimary = matchedFromPrimary || synInPrimary;
                         score += (isFullWeight ? w : w * .5) * (synInPrimary ? 1 : .5);
                     }
                 });
             score = Math.min(score, 100);
             // v9.6: resolver-bearing entries (currently just
             // "install", handing off to the object-based
             // resolver) win when their OWN keyword explicitly
             // matched, even against a competing entry with a
             // marginally higher raw score -- an explicit
             // "install"/"setup" verb is a stronger signal of
             // what the customer wants DONE than which object
             // happened to score a few points higher. Without
             // this, "install a new faucet" let "faucet" (a
             // plain object entry, no resolver) win outright and
             // skip the object-based resolver step entirely,
             // defaulting to faucet's own "Repair" stype instead
             // of correctly resolving to Install.
             const resolverShouldWin = m.resolver && kwMatched && !(bestMapping?.resolver);
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
             // The actual confidence score used to pick this match —
             // was computed and then discarded before; now attached
             // so downstream code (the recommendedSku banner's
             // auto-select) can gate on the REAL number instead of
             // re-estimating or assuming a SKU implies confidence.
             if (score > top || resolverShouldWin) {
                 top = resolverShouldWin ? Math.max(score, top) : score;
                 bestMapping = m;
                 best = buildCandidate(m, score);
                 bestMatchedFromPrimary = matchedFromPrimary;
             }
         }

         // T112 FIX (PENDING_DECISIONS #37): a shorter entry's own
         // bare keyword can legitimately be a whole word embedded
         // inside a DIFFERENT entry's own authored, multi-word
         // synonym for the exact same real-world object -- e.g.
         // "washer" inside dishwasher's own synonym "dish washer".
         // The v9.5 fix above already stops "washer" from matching
         // as a bare substring inside the single word "dishwasher"
         // (no space, no word boundary between them); it does NOT
         // stop "washer" from being a genuine, separately
         // word-bounded match when the customer writes the natural
         // two-word "dish washer" instead -- same underlying
         // confusion the v9.5 fix's own test case was named for,
         // reintroduced by a different, equally common spelling.
         // Confirmed via direct test this was live before this fix:
         // "fix my dish washer" resolved to washer_repair, not
         // anything dishwasher-related, because "washer"'s own
         // full keyword weight (90) beat dishwasher's un-promoted
         // synonym weight (45) outright, and even promoting that
         // synonym to full weight would only produce a 90-90 TIE —
         // the existing tie-break is pure array order (see the
         // v9.5 comment above), not a reliable resolution either
         // way. When a genuinely more specific, multi-word phrase
         // belonging to a DIFFERENT entry contains the current
         // winner's own bare keyword, the customer's actual words
         // point at that more specific entry, and it should win
         // regardless of raw score or array order. Deliberately
         // narrow: only ever triggers on an AUTHORED catalog
         // phrase (a real keyword or synonym already in the data),
         // never a coincidental substring of arbitrary free text.
         //
         // SAFETY CONDITIONS, both added after direct testing
         // showed the mechanism above, unconstrained, changed 29
         // different phrases catalog-wide -- far past the one
         // diagnosed bug this fix was scoped to. Most of those 29
         // were trading a confident WRONG answer for an
         // unconfident right-ish one (new score well under this
         // catalog's own real confidence gates), which is not
         // the same fix and was never verified case-by-case. Two
         // conditions bring the mechanism back to exactly the
         // diagnosed shape, confirmed via a full 441-string sweep
         // of every keyword/synonym in the catalog before/after:
         // only "dish washer" (the diagnosed bug) and "drawer
         // front" (same resulting SKU either way, so a no-op for
         // the customer) still change.
         //   1. The more-specific candidate must clear this
         //      catalog's own real confidence gate on its own
         //      merits -- otherwise this would silently replace
         //      one problem (wrong-but-confident) with a
         //      different one (right-ish-but-uncertain) for
         //      dozens of other phrases never individually
         //      checked. Left as future work, recorded rather
         //      than shipped unverified: PENDING_DECISIONS #38.
         //   2. Never override a resolver-bearing entry (e.g.
         //      "install") -- that mechanism is already, by
         //      original design (see the resolverShouldWin
         //      comment above), a deliberately stronger signal
         //      than a raw score, and should stay authoritative.
         if (bestMapping && bestMapping.keyword && !bestMapping.resolver) {
             const loserKw = bestMapping.keyword.toLowerCase();
             const specificityGate = (DB.global_rules?.thresholds?.route_to_group_other_tile) ?? 50;
             crossEntrySpecificity: for (const m2 of maps) {
                 if (m2 === bestMapping) continue;
                 const kw2 = (m2.keyword || '').toLowerCase();
                 const phrases = [kw2].concat(
                     Array.isArray(m2.synonyms) ? m2.synonyms.filter(s => typeof s === 'string').map(s => s.toLowerCase()) : []
                 );
                 for (const phrase of phrases) {
                     if (!phrase || !phrase.includes(' ')) continue; // only genuinely multi-word phrases count as "more specific"
                     if (phrase === loserKw) continue;
                     if (!wordBoundaryIncludes(phrase, loserKw)) continue; // does this authored phrase itself contain the current winner's bare keyword as a whole word?
                     if (!wordBoundaryIncludes(lower, phrase)) continue; // does the CUSTOMER'S text actually contain this longer phrase?
                     const isKwMatch = phrase === kw2;
                     const w2 = m2.confidence_weight || 30;
                     const isFullWeight = isKwMatch || (Array.isArray(m2.full_weight_synonyms) && m2.full_weight_synonyms.includes(phrase));
                     const m2Score = Math.min(isFullWeight ? w2 : w2 * .5, 100);
                     if (m2Score < specificityGate) continue; // safety condition 1 -- see block comment above
                     bestMapping = m2;
                     top = m2Score;
                     best = buildCandidate(m2, m2Score);
                     break crossEntrySpecificity;
                 }
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
                 // v9.6 FIX (real, pre-existing bug found while testing an
                 // unrelated cabinets change): this loop had no early exit,
                 // so a LATER, broader-matching override (e.g. "new door" as
                 // a substring of "new door handle") would silently
                 // overwrite an EARLIER, more specific match's entire
                 // resolution (sku, price, fee, tags) -- confirmed via
                 // direct test: "need a new door handle" resolved to
                 // prehung_interior_door_install ($150) instead of the
                 // correct door_lock_or_handle_install ($50), clobbering the
                 // "handle" match with the broader "new door" one purely
                 // because it appears later in the array. Each override
                 // block is a cohesive, complete intent bucket (sku + price
                 // + fee + tags together, not independently composable
                 // fields), and the authored order is the intended priority
                 // (specific hardware terms checked before the broad
                 // full-door catch-all) -- so once one fires, stop.
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
                     // v9.5.11 FIX: a real, specific, secondary
                     // phrase match (e.g. "flushometer", "back up")
                     // is genuine, explicit evidence of correct
                     // resolution -- confirmed via direct trace
                     // this was previously invisible to
                     // orch_compute_confidence entirely, which
                     // only ever reads the raw, pre-override
                     // _matchConfidence. A resolver that
                     // successfully narrows via an explicit,
                     // named phrase should be at least as
                     // confident as the strongest plain-keyword
                     // case, not stuck at whatever the ORIGINAL,
                     // less-specific keyword alone scored.
                     // Math.max (a floor, not an overwrite) so a
                     // genuinely higher raw keyword score is
                     // never reduced by this. Flagged for
                     // business/product review, same as every
                     // other judgment-based threshold this
                     // project has authored (T20/T67/T69/v9.5.10)
                     // -- not claimed as a precisely-tuned number.
                     best._matchConfidence = Math.max(best._matchConfidence || 0, 90);
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
                 // v9.6 FIX: stop after the first override that changed the
                 // sku -- see the comment above where ctxMatched is checked
                 // for the full reasoning. Overrides with no override_sku
                 // (pure fee/tag refinements, if any exist) are unaffected
                 // and continue to accumulate as before.
                 if (ctx.override_sku) break;
             }
         }

         if (!best) {
             const fb = DB.intent_mappings?.default_fallback;
             if (fb) best = {
                 category: fb.category || 'other',
                 stype: normStype(fb.service_type || 'Repair'),
                 group: 'other',
                 base: fb.base_price || FALLBACKS.base_price,
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
                 // detectActionsInOrder already correctly uses
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
                     let bestSibling = null,
                         bestSiblingScore = defaultScore;
                     for (const sib of siblings) {
                         const s = scoreAgainst(sib);
                         if (s > bestSiblingScore) {
                             bestSiblingScore = s;
                             bestSibling = sib;
                         }
                     }
                     if (bestSibling) {
                         best.recommendedSku = bestSibling.id;
                         best._descriptionOverride = true;
                         // v9.5.11 FIX: same real gap as
                         // _hadContextualOverride above -- this
                         // mechanism's own design (see its
                         // header comment) is intentionally
                         // WEAKER than a contextual_override: it
                         // only ever breaks a tie against a
                         // sibling's real description, never
                         // wins standalone. Floor is
                         // correspondingly more modest (75, not
                         // 90) -- real, positive evidence the
                         // resolution is correct, but not
                         // treated as strong as an explicit,
                         // named secondary phrase match.
                         best._matchConfidence = Math.max(best._matchConfidence || 0, 75);
                     }
                 }
             }
         }
         // T118 #30 FIX: "require minimum match support before
         // committing to a named service on a single incidental
         // keyword" -- the third piece of PENDING_DECISIONS.md #30's
         // fix. bestMatchedFromPrimary is false only when EVERY
         // match contributing to this winner's score came from
         // beyond the first ~15 words (the "plaster" trace's exact
         // shape). Deliberately does NOT suppress category/stype/
         // group -- general routing on a weak signal is still
         // better than no routing -- only the specific, named-
         // service commitment a customer would see as a confident
         // recommendation. Checked AFTER contextual_override and
         // the description-based sibling override above (not
         // before): both represent genuine, ADDITIONAL evidence
         // beyond the single incidental keyword -- exactly what
         // "minimum match support" means to require, not a reason
         // to suppress harder.
         if (best && !bestMatchedFromPrimary && !best._hadContextualOverride && !best._descriptionOverride) {
             best.recommendedSku = null;
             best._recommendedSkuSuppressedIncidental = true;
         }
         if (!_nlpQuiet && typeof _trace === 'function') _trace('nlp_engine', 'detectIntentNLP: intent matched', {
             rawText: text,
             winningKeyword: best?.key || null,
             matchConfidence: best?._matchConfidence ?? null,
             category: best?.category || null,
             dynamicRule: best?.dynamic_rule || null,
             recommendedSku: best?.recommendedSku || null,
             hadContextualOverride: !!best?._hadContextualOverride,
             recommendedSkuSuppressedIncidental: !!best?._recommendedSkuSuppressedIncidental,
         });
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

     function _extractObjectRaw(text, intentKeyword) {
         const SKIP = _SKIP_WORDS(),
             VERBS = _SVC_VERBS(),
             PREPS = _STOP_PREPS();
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
             (mapping?.synonyms || []).forEach(s => {
                 if (typeof s === 'string') kwSynonyms.add(s.toLowerCase());
             });
         }
         const words = lower.split(/\s+/).filter(Boolean);
         let objWords = [],
             inObj = false;
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
             if (isServiceVerb(w, VERBS)) {
                 inObj = true;
                 continue;
             }
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
             // v9.6 FIX: a real, confirmed bug found via direct trace
             // ("I need 5 ceiling tiles in my office replaced" ->
             // extractedObject: "office", not "ceiling tiles") --
             // when a prepositional LOCATION phrase sits between the
             // real object and a trailing verb, the original scan
             // stopped at the first preposition it hit walking
             // backward from the verb, which is exactly the
             // location's own leading preposition ("in") --
             // incorrectly returning the location noun itself
             // ("office") as the object, never reaching the real
             // object sitting further back ("ceiling tiles").
             // Fix: when the scan stops having just collected a
             // phrase, check whether it's itself a recognized
             // room/location word (the same vocabulary
             // extractLocation uses) -- if so, this was a location
             // phrase, not the object; walk back past both its
             // determiner ("my") and its own leading preposition
             // ("in") and resume scanning from there for the real
             // object. Bounded (max 3 attempts) so a sentence
             // naming multiple real locations doesn't get guessed
             // through indefinitely.
             const rooms = new Set((_ROOMS_LIST() || []).map(r => r.toLowerCase()));
             let end = lastVerbIdx;
             for (let attempt = 0; attempt < 3; attempt++) {
                 const backward = [];
                 let i = end - 1;
                 for (; i >= 0; i--) {
                     const bw = words[i];
                     if (PREPS.has(bw) || CLAUSE.has(bw)) break;
                     if (SKIP.has(bw) || /^\d/.test(bw)) {
                         if (backward.length > 0) break;
                         continue;
                     }
                     backward.unshift(bw);
                     if (backward.length >= 3) break;
                 }
                 const candidate = backward.join(' ').trim();
                 if (candidate.length >= 2 && rooms.has(candidate.toLowerCase())) {
                     let leadIdx = i;
                     while (leadIdx >= 0 && SKIP.has(words[leadIdx])) leadIdx--;
                     if (leadIdx >= 0 && PREPS.has(words[leadIdx])) leadIdx--;
                     end = leadIdx + 1;
                     continue;
                 }
                 if (candidate.length >= 2) return candidate;
                 break;
             }
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
     const _QTY_WORD_MAP = {
         one: 1,
         two: 2,
         three: 3,
         four: 4,
         five: 5,
         six: 6,
         seven: 7,
         eight: 8,
         nine: 9,
         ten: 10
     };

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
         if (m) {
             // v9.6 FIX: only treat a bare digit as a real quantity
             // signal if it appears alongside actual other content --
             // a customer typing literally just a number (e.g. "12345")
             // with nothing else has given no real quantity context at
             // all, and was previously clamped to qty=99 regardless,
             // producing a wildly wrong quote for meaningless input.
             const remainder = stripped.replace(m[0], ' ').replace(/[^a-z]/gi, '').trim();
             if (remainder.length === 0) return 1;
             return Math.min(parseInt(m[1]), 99);
         }
         return 1;
     }

     function extractLocation(text) {
         // T118 (PENDING_DECISIONS.md #19): two real, distinct
         // gaps found and fixed together, confirmed via direct
         // testing before combining them, not assumed:
         //
         // 1. The preposition set was `in|into` only -- "above my
         // stove", "behind my fridge", "under my sink" all failed
         // to extract ANY location before this fix, regardless of
         // vocabulary, since the regex itself never matched.
         // Confirmed directly: expanding this alone, with zero
         // vocabulary changes, already made appliance terms fall
         // through to the existing raw-fallback branch correctly.
         //
         // 2. That raw fallback alone isn't enough for real value:
         // it would return "stove" as a bare, unmapped string,
         // which can never match an existing or future
         // location_hints entry authored against room names
         // (checked directly: the one real, live use of
         // location_hints today, door_style_pref, keys entirely
         // on room names). Added a new, deliberately conservative
         // nlp_location_appliance_map for terms with a single,
         // unambiguous real-world room (stove/oven/fridge/
         // dishwasher -> kitchen; toilet/tub/shower -> bathroom;
         // washer/dryer -> laundry room) so "above my stove"
         // resolves to the same canonical "kitchen" that "in my
         // kitchen" already did. Genuinely ambiguous terms (sink:
         // kitchen or bathroom; water heater: basement/garage/
         // utility) are deliberately left OUT of this map rather
         // than guessing -- they still extract as their own raw
         // string via the fallback below, same as before.
         const SKIP = _SKIP_WORDS(),
             VERBS = _SVC_VERBS(),
             ROOMS = _ROOMS_LIST();
         // Inlined directly (not a separate _APPLIANCE_ROOM_MAP
         // helper) deliberately: several existing tests extract
         // extractLocation's own source in isolation via a
         // findFn-style mechanism and run it in a sandbox that
         // only includes the specific helper functions they
         // already know about. A new, separately-named helper
         // function would be invisible to every one of those
         // tests' own extraction lists, throwing "not defined" --
         // confirmed directly: this was the actual, real failure
         // mode on first attempt (verify_microwave_stove_ordering_fix.js
         // and 18 others), not a hypothetical concern. Reading
         // window._NLP directly here has no new dependency beyond
         // what _ROOMS_LIST itself already relies on.
         const APPLIANCES = window._NLP?.APPLIANCES || {};
         const lower = text.toLowerCase();
         const m = lower.match(/\b(?:in|into|above|near|behind|under|beside|by|next to)\s+(?:my|the|our|a)?\s*([a-z][a-z\s]{2,20})\b/);
         if (!m) return null;
         const loc = m[1].trim().replace(/\s+/g, ' ');
         for (const room of ROOMS) {
             if (loc.startsWith(room) || loc === room) return room;
         }
         if (APPLIANCES[loc]) return APPLIANCES[loc];
         const lw = loc.split(' ');
         return (lw.length <= 3 && lw.every(w => w.length > 1)) ? loc : null;
     }

     function extractSizeHint(text, tags) {
         // Detect dimensions like 12x12, 6ft, 65 inch, "6ft x 4ft"
         const lower = text.toLowerCase();
         // v9.5 FIX: original regex /(\d+)\s*[x×]\s*(\d+)/ missed "6ft x 4ft"
         // because the unit suffix came between the digit and the x.
         // Also fixed dimension thresholds: the original 200/600 was calibrated
         // for inches/pixels. For feet-based dimensions (6ft x 4ft = 24 sq ft),
         // we compare against ft-appropriate thresholds (>12 sq ft = large,
         // >30 sq ft = oversized). For pure numbers, keep the original thresholds.

         // Check for feet-based dimensions: "6ft x 4ft", "3 ft x 5 ft"
         const ftDimMatch = lower.match(/(\d+)\s*(?:ft|feet|foot)\s*[x×]\s*(\d+)/);
         if (ftDimMatch) {
             const area = parseInt(ftDimMatch[1]) * parseInt(ftDimMatch[2]);
             if (area >= 30) return 'oversized'; // 6x5ft, 5x6ft etc
             if (area >= 12) return 'large'; // 4x3ft, 6x2ft etc
             return 'standard';
         }
         // Inch/pure dimension: 12x12, 24x36 etc
         const dimMatch = lower.match(/(\d+)\s*[x×]\s*(\d+)/);
         if (dimMatch) {
             const area = parseInt(dimMatch[1]) * parseInt(dimMatch[2]);
             if (area > 600) return 'oversized';
             if (area > 200) return 'large';
             return 'standard';
         }
         // "12 inch", "65 inch" TV → heavy/large
         const inchMatch = lower.match(/(\d+)\s*(?:inch|in\b|")/);
         if (inchMatch) {
             const n = parseInt(inchMatch[1]);
             if (n >= 65) return 'large'; // 65"+ TV → heavy_item candidate
             if (n <= 24) return 'standard';
         }
         // Foot-based single dimension: "6ft sign", "8 foot banner"
         const ftMatch = lower.match(/(\d+)\s*(?:foot|feet|ft)\b/);
         if (ftMatch) {
             const n = parseInt(ftMatch[1]);
             if (n >= 8) return 'oversized';
             if (n >= 5) return 'large';
         }
         // v9.6 FIX: real content gap, confirmed via
         // verify_ssot_consultation.js's own prior finding
         // ("CONFIRMED REAL GAP, not accepted-dead") --
         // this previously used a narrower, hardcoded,
         // duplicate word list instead of the real, carefully
         // -authored negation_library.large_size_words/
         // standard_size_words (21 words combined). Confirmed
         // via direct comparison the hardcoded version was
         // missing real entries ("bulky", "extra large",
         // "giant", "king size", "massive", "xl") and never
         // consulted standard_size_words at all. "neon sign"
         // kept as its own, separate item-type proxy --
         // confirmed via its own comment this was never really
         // a size word, just a real, common large/heavy-item
         // signal that happens to live in this function.
         const nl = (typeof DB !== 'undefined' ? DB : window.DB)?.negation_library || {};
         const largeSizeWords = nl.large_size_words || [];
         const standardSizeWords = nl.standard_size_words || [];
         if (largeSizeWords.length && new RegExp('\\b(' + largeSizeWords.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')\\b', 'i').test(lower)) return 'large';
         if (/\bneon sign\b/i.test(text)) return 'large';
         if (standardSizeWords.length && new RegExp('\\b(' + standardSizeWords.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')\\b', 'i').test(lower)) return 'standard';
         return null;
     }

     function inferTagsFromContext(text, cat, groupId) {
         // Infer tags from contextual hints in the text
         const lower = text.toLowerCase();
         const inferred = [];
         // v9.6 FIX: _BRICK_HINTS was referenced but never defined
         // anywhere in this file -- every call to this function threw
         // ReferenceError: _BRICK_HINTS is not defined and crashed the
         // entire collectBookingContext_freeText/sqAnalyze flow whenever
         // this line was reached. Derived from #brick_wall's own SSOT
         // synonyms (single source of truth) instead of a hardcoded
         // parallel word list that could drift from the tag's real data.
         const _BRICK_HINTS = DB.smart_tags?.['#brick_wall']?.synonyms || ['brick', 'concrete', 'masonry', 'cinder block', 'stone', 'cement', 'mantel', 'mantle', 'fireplace'];
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

     function computeNegatedGroupHints(negatedTagIds, smartTags) {
         // T36: translate explicit tag negations into group/category
         // deprioritization hints. Only tags carrying real group/category
         // specificity (applicable_group_ids / applicable_categories)
         // participate -- the ~10 universal/logistic tags (parking, pets,
         // urgency, etc.) correctly contribute nothing: negating "pets
         // present" tells you nothing about which room or trade the job
         // involves.
         const groups = new Set(),
             categories = new Set();
         for (const tid of (negatedTagIds || [])) {
             const tag = smartTags?.[tid];
             if (!tag) continue;
             (tag.applicable_group_ids || []).forEach(g => groups.add(g));
             if (!tag.applicable_group_ids || tag.applicable_group_ids.length === 0) {
                 (tag.applicable_categories || []).forEach(c => categories.add(c));
             }
         }
         return {
             groups,
             categories
         };
     }

     function resolveGroupFromIntent(category, objectNoun, stype, fullText, negatedGroupHints = null, matchMeta = null) {
         // v9.5.12: matchMeta is a real, additive, optional signal
         // channel -- raised directly: this function's own rule
         // data already distinguishes a specific keyword match
         // from a catchAll:true fallback (confirmed: the data
         // has carried this distinction since it was authored),
         // but the function's return value has always discarded
         // it -- a bare group-ID string either way. Changing the
         // RETURN TYPE itself would touch all 7 real call sites
         // across qr.html/orchestrator_engine.js/AppController.js,
         // several of which use the result directly as a string
         // (e.g. comparing against a real group's .id) -- a
         // return-shape change risks a silent type mismatch at
         // any site not updated to match. This is the safer,
         // fully backward-compatible alternative: an optional
         // object a caller can pass in and read back afterward;
         // every existing call site needs zero changes, since
         // the parameter defaults to null and nothing is written
         // unless a caller actually asks for it.
         if (matchMeta) {
             matchMeta.isCatchAll = false;
             matchMeta.isDeferredNegationFallback = false;
         }
         if (!category || !DB?.group) return null;
         const obj = (objectNoun || '').toLowerCase();
         const groups = (DB.group || []).filter(g => g.category_id === category);
         if (!groups.length) return null;

         // ── Cross-category override by object noun ─────────────────
         // 'install' keyword maps to minor_home_repairs but some objects
         // clearly belong in other categories — fan, router, thermostat etc.
         const crossCategory = [{
                 keywords: ['fan', 'ceiling fan'],
                 cat: 'electric_lighting',
                 group: 'electric_lighting_fans'
             },
             {
                 keywords: ['light', 'fixture', 'chandelier', 'pendant', 'sconce'],
                 cat: 'electric_lighting',
                 group: 'electric_lighting_light_fixtures'
             },
             {
                 keywords: ['outlet', 'socket', 'gfci', 'usb outlet'],
                 cat: 'electric_lighting',
                 group: 'electric_lighting_outlets'
             },
             {
                 keywords: ['switch', 'dimmer'],
                 cat: 'electric_lighting',
                 group: 'electric_lighting_switches'
             },
             {
                 keywords: ['thermostat', 'nest', 'ecobee'],
                 cat: 'electric_lighting',
                 group: 'electric_lighting_thermostats'
             },
             {
                 keywords: ['router', 'wifi', 'extender', 'network'],
                 cat: 'tech_trouble',
                 group: 'tech_trouble_networking'
             },
             {
                 keywords: ['smart home', 'smart plug', 'smart speaker', 'alexa', 'google home'],
                 cat: 'tech_trouble',
                 group: 'tech_trouble_smart_home'
             },
             {
                 keywords: ['faucet', 'tap', 'sink'],
                 cat: 'plumbing_help',
                 group: 'plumbing_help_sinks'
             },
             {
                 keywords: ['toilet', 'bidet'],
                 cat: 'plumbing_help',
                 group: 'plumbing_help_toilets'
             },
             {
                 keywords: ['disposal', 'garbage disposal'],
                 cat: 'plumbing_help',
                 group: 'plumbing_help_garbage_disposals'
             },
             {
                 keywords: ['shower', 'tub', 'spout', 'showerhead', 'shower head', 'clog', 'clogged', 'drain'],
                 cat: 'plumbing_help',
                 group: 'plumbing_help_showers_tubs'
             },
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
             wall_mounting: [{
                     keywords: ['tv', 'television', 'flatscreen', 'flat screen', 'monitor', 'screen', 'display'],
                     group: 'wall_mounting_tv_flatscreen'
                 },
                 {
                     keywords: ['blind', 'curtain', 'drape', 'shade', 'roman shade'],
                     group: 'wall_mounting_blinds_curtain'
                 },
                 {
                     keywords: ['brick', 'concrete', 'masonry', 'stone', 'cinder block'],
                     group: 'wall_mounting_brick_or_concrete'
                 },
                 {
                     keywords: ['drywall', 'plaster', 'gypsum'],
                     group: 'wall_mounting_drywall_or_plaster'
                 },
                 // catch-all for wall_mounting: frames, shelves, signs, neon, art, etc.
                 {
                     keywords: [],
                     group: 'wall_mounting_frames_shelves',
                     catchAll: true
                 }
             ],
             minor_home_repairs: [{
                     keywords: ['washer', 'washing machine'],
                     group: 'minor_home_repairs_appliances_washer'
                 },
                 {
                     keywords: ['dryer'],
                     group: 'minor_home_repairs_appliances_dryer'
                 },
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
                 {
                     keywords: ['microwave'],
                     group: 'minor_home_repairs_appliances_microwave'
                 },
                 {
                     keywords: ['stove', 'oven', 'range', 'cooktop', 'burner'],
                     group: 'minor_home_repairs_appliances_stove_range'
                 },
                 {
                     keywords: ['fridge', 'refrigerator', 'freezer', 'frig'],
                     group: 'minor_home_repairs_appliances_refrigerator'
                 },
                 {
                     keywords: ['dishwasher'],
                     group: 'minor_home_repairs_appliances_dishwasher'
                 },
                 {
                     keywords: ['window ac', 'air conditioner', 'ac unit', 'window unit'],
                     group: 'minor_home_repairs_appliances_window_ac'
                 },
                 {
                     keywords: ['cabinet', 'drawer', 'cupboard', 'pantry', 'wardrobe', 'kitchen island', 'breakfast bar'],
                     group: 'minor_home_repairs_cabinets_drawers'
                 },
                 {
                     keywords: ['door', 'hinge', 'knob', 'deadbolt', 'entry'],
                     group: 'minor_home_repairs_doors'
                 },
                 // v9.6 NEW: must come BEFORE the generic tile rule
                 // below -- this function's own loop is first-match-
                 // wins (confirmed directly), and 'tile' alone would
                 // otherwise capture "ceiling tile" too (a genuinely
                 // different real product/job -- see T96/T97).
                 // Deliberately multi-word keywords only (not bare
                 // "ceiling"), matching intent_mappings.objects'
                 // own synonyms exactly -- bare "ceiling" would
                 // wrongly capture unrelated, already-correctly-
                 // routed requests (ceiling fan, ceiling crack/
                 // drywall, ceiling paint).
                 {
                     keywords: ['ceiling tile', 'drop ceiling', 'acoustic tile', 'suspended ceiling', 'ceiling panel'],
                     group: 'minor_home_repairs_ceilings'
                 },
                 {
                     keywords: ['floor', 'tile', 'baseboard', 'trim', 'molding', 'moulding', 'grout', 'hardwood'],
                     group: 'minor_home_repairs_floors_trim'
                 },
                 {
                     keywords: ['chair', 'sofa', 'couch', 'desk', 'table', 'furniture', 'bed frame', 'dresser', 'headboard', 'footboard', 'four-poster'],
                     group: 'minor_home_repairs_furniture'
                 },
                 {
                     keywords: ['wall', 'drywall', 'plaster', 'crack', 'hole', 'stucco', 'patch'],
                     group: 'minor_home_repairs_walls'
                 },
                 {
                     keywords: ['window', 'sash', 'pane', 'screen', 'sill'],
                     group: 'minor_home_repairs_windows'
                 },
                 // Literal "appliance" mention only — NOT a real catch-all
                 // (no catchAll:true flag), unlike wall_mounting's genuine
                 // frames_shelves catch-all below. minor_home_repairs has
                 // no single group that's a sensible default for every
                 // unmatched object, so unmatched objects correctly fall
                 // through to resolveGroupFromIntent's `return null` —
                 // see that function's docstring/contract.
                 {
                     keywords: ['appliance'],
                     group: 'minor_home_repairs_appliances'
                 }
             ],
             plumbing_help: [{
                     keywords: ['disposal', 'garbage disposal'],
                     group: 'plumbing_help_garbage_disposals'
                 },
                 {
                     keywords: ['sink', 'faucet', 'tap', 'basin'],
                     group: 'plumbing_help_sinks'
                 },
                 {
                     keywords: ['shower', 'tub', 'bath', 'spout', 'showerhead', 'shower head', 'clog', 'clogged', 'drain'],
                     group: 'plumbing_help_showers_tubs'
                 },
                 {
                     keywords: ['toilet', 'commode', 'bidet'],
                     group: 'plumbing_help_toilets'
                 },
                 {
                     keywords: ['water line', 'pipe', 'supply line'],
                     group: 'plumbing_help_water_lines'
                 }
             ],
             electric_lighting: [{
                     keywords: ['bulb', 'light bulb', 'lamp'],
                     group: 'electric_lighting_bulbs'
                 },
                 {
                     keywords: ['fan', 'ceiling fan'],
                     group: 'electric_lighting_fans'
                 },
                 {
                     keywords: ['fixture', 'light fixture', 'chandelier', 'pendant', 'sconce'],
                     group: 'electric_lighting_light_fixtures'
                 },
                 {
                     keywords: ['outlet', 'plug', 'socket', 'gfci', 'usb outlet'],
                     group: 'electric_lighting_outlets'
                 },
                 {
                     keywords: ['switch', 'dimmer', 'light switch'],
                     group: 'electric_lighting_switches'
                 },
                 {
                     keywords: ['thermostat', 'nest', 'ecobee'],
                     group: 'electric_lighting_thermostats'
                 }
             ],
             tech_trouble: [{
                     keywords: ['computer', 'laptop', 'desktop', 'pc', 'mac', 'hard drive', 'virus', 'slow computer', 'backup', 'data backup'],
                     group: 'tech_trouble_computer_repair'
                 },
                 {
                     keywords: ['cable', 'cord', 'wire', 'hdmi', 'power strip'],
                     group: 'tech_trouble_cable_management'
                 },
                 {
                     keywords: ['wifi', 'router', 'network', 'internet', 'extender'],
                     group: 'tech_trouble_networking'
                 },
                 {
                     keywords: ['smart home', 'alexa', 'google home', 'smart plug', 'smart switch', 'smart speaker'],
                     group: 'tech_trouble_smart_home'
                 }
             ],
             furniture_fixes_assembly: [{
                     keywords: [],
                     group: 'furniture_fixes_assembly_assembly',
                     stypes: ['Assembly']
                 },
                 {
                     keywords: [],
                     group: 'furniture_fixes_assembly_repair',
                     stypes: ['Repair']
                 },
                 {
                     keywords: [],
                     group: 'furniture_fixes_assembly_disassembly',
                     stypes: ['Disassembly']
                 }
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

         // T36: a rule whose group was explicitly negated (via tag
         // removal) is deferred rather than excluded -- remembered as
         // a last-resort fallback, tried only if no other rule matches
         // anywhere in any pass. This is the real adaptation of the
         // design doc's "penalty" concept to this function's actual
         // architecture (a deterministic first-match rule cascade, not
         // a numeric scoring loop) -- deferring to last resort plays
         // the same role a capped penalty would, without inventing an
         // arbitrary magnitude for code that has no score to apply it to.
         const isNegated = (groupId) => !!negatedGroupHints?.groups?.has(groupId);
         let deferredMatch = null;

         // Match object noun against keyword lists
         for (const rule of catRules) {
             if (rule.catchAll) continue; // skip catch-alls in first pass
             // stype-only rules (furniture_fixes_assembly)
             if (rule.stypes && !rule.keywords.length) {
                 if (stype && rule.stypes.some(st => stype.toLowerCase().includes(st.toLowerCase()))) {
                     if (groups.find(g => g.id === rule.group)) {
                         if (isNegated(rule.group)) {
                             deferredMatch = deferredMatch || rule.group;
                             continue;
                         }
                         return rule.group;
                     }
                 }
                 continue;
             }
             if (rule.keywords.some(kw => objWordBoundaryIncludes(obj, kw))) {
                 if (groups.find(g => g.id === rule.group)) {
                     if (isNegated(rule.group)) {
                         deferredMatch = deferredMatch || rule.group;
                         continue;
                     }
                     return rule.group;
                 }
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
                     if (groups.find(g => g.id === rule.group)) {
                         if (isNegated(rule.group)) {
                             deferredMatch = deferredMatch || rule.group;
                             continue;
                         }
                         return rule.group;
                     }
                 }
             }
         }

         // Second pass: catch-alls
         for (const rule of catRules) {
             if (rule.catchAll && groups.find(g => g.id === rule.group)) {
                 if (isNegated(rule.group)) {
                     deferredMatch = deferredMatch || rule.group;
                     continue;
                 }
                 if (matchMeta) matchMeta.isCatchAll = true;
                 return rule.group;
             }
         }

         // Last resort: a negated group that matched is still better
         // than no group at all -- the negation deprioritizes, it
         // never permanently forbids.
         if (deferredMatch) {
             if (matchMeta) matchMeta.isDeferredNegationFallback = true;
             return deferredMatch;
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
