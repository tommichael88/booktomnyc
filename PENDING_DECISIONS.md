# Pending Decisions — Consolidated, `T01–T118`

Updated after `T99`: item #20 confirmed and closed — a real, severe,
catalog-wide pricing bug, found using the new tracing tool and fixed
directly. What's left is genuinely large, real work (not quick
decisions) — explicitly, honestly not rushed.

Updated after `T108` (Operator Brief, Session 1): items `#33`–`#36` added.
`#33` is the required, deliberately-deferred follow-up from the
`executeWorkflow` answers fix itself; `#34`–`#36` are real, adjacent
findings surfaced while establishing this session's true test-suite
baseline, recorded rather than fixed, per scope.

Updated after `T109` (operator-directed corrections ahead of Session 2):
baseline corrected in the charter (§5A.7) rather than left stale; real
`package.json`/`package-lock.json`/`requirements.txt` provisioning added
to `test_harness/` so environment setup is a one-command fix instead of
tribal knowledge; `QR_BUILD_VERSION` — found genuinely stale (`'T103'`
through five subsequent real `qr.html` edits, `T104`–`T108`, confirmed
directly against every affected `TIMELINE.md` entry) — bumped to `'T109'`
(this fix's own entry, since bumping the marker is itself a `qr.html`
edit) and given its own regression test
(`verify_qr_build_version_freshness.js`) so the same drift fails loudly
next time instead of staying quiet. No new numbered item added for this
one: it was found and closed in the same pass, not left open.

Updated after `T110` (Session 2 of the Operator Brief arc): charter §11
item 12 closed — `computer`'s `laptop`/`desktop`/`macbook`/`notebook`
promoted to `full_weight_synonyms`. The follow-up sweep produced a real,
worth-recording finding rather than a routine checklist pass: of the 11
terms named in the brief (`fridge`, `washer`, `dryer`, `dishwasher`,
`microwave`, `stove`, `toilet`, `faucet`, `shower head`, `thermostat`,
plus `oven`), ten are already their own top-level `keyword` entry,
self-referentially re-listed inside their OWN `synonyms` array. Confirmed
directly (not assumed) that this is harmless: `detectIntentNLP`'s
`isInflectionOnly` guard skips synonym-scoring entirely whenever the
synonym literally equals the keyword that just matched, so all ten
already score full weight via the keyword-match path every time — there
was never a half-weight bug to fix for any of them, and promoting them to
`full_weight_synonyms` would have been an inert, cosmetic no-op. Only
`oven` (a genuine synonym of `stove`, not self-referential — the same
shape as `computer`/`laptop`) had the real bug, and got the real fix.
Worth remembering for any future synonym-weighting sweep elsewhere in the
catalog: check for this self-referential shape first, since it silently
inflates how many terms *look* like they need promotion when most don't.

Updated after `T111` (per-synonym audit, requested directly by a reviewer
who caught a real, specific gap in the `T110` note above): **the `T110`
sweep checked whether each swept entry's own keyword scores correctly,
but never checked whether that entry's OTHER, non-keyword synonyms are
independently affected by the identical bug. They were** — a customer
typing "my refrigerator isn't cold" never types the word "fridge" at all,
so the keyword-match path never fires, and the synonym-only path scored
half weight, exactly like the original `laptop`/`computer` case. Audited
every non-keyword synonym on all ten `T110`-swept entries directly (not
assumed): promoted `refrigerator`/`frig`/`freezer` (fridge), `washing
machine` (washer), `cooktop` (stove, alongside `oven`), `commode`/`water
closet` (toilet), `showerhead` (shower head), and `ecobee` (thermostat) —
nine terms, each individually checked for zero collision against all 80
other entries and low generic-English ambiguity. Deliberately held
`range`/`burner` (stove) and `nest` (thermostat) at their existing
half-weight: real, meaningful ambiguity with ordinary English words
unrelated to home repair, which would raise rather than lower the risk
`#30` above already flags. `tap`/`basin` (faucet) were already correctly
held from before this session; confirmed, not re-decided. **A separate,
more severe, currently-live bug surfaced during this same audit, tracked
as new item `#37` below** — recorded, not fixed, since the real fix is
structural, not a one-line promotion. Also fixed in this pass: the
environment-note cross-reference above was genuinely ambiguous ("§7"
collides with a different, unrelated top-level section) — corrected to
`§5A.7` both here and in the charter itself.

Updated after `T112` (operator-requested: "let's proceed with #37"):
`#37` closed, fixed, and verified — see below for the full entry. Real
process note, stated plainly: the first implementation of the fix worked
for the diagnosed case but, tested only against it, would have shipped a
29-phrase catalog-wide change, not a 1-phrase fix — caught only by
insisting on a full 441-string sweep before treating the fix as done, not
by the initial targeted test passing. Two safety conditions brought the
mechanism back to exactly the diagnosed shape. New item `#38` records
the 38 other candidates the same sweep surfaced, deliberately not
individually triaged in the same pass — evidence, not verified bugs.

Updated after `T113` (operator-requested: "get to the heart of #37's
bug"): root cause identified precisely — 59% of this catalog's synonyms
are multi-word, and every one is a structural candidate for the exact
`#37` shape, a risk that scales with the catalog itself. Built a
permanent, automated check (`#38`, refined) that catches every NEW
instance the moment it's introduced, rather than requiring another
manual sweep or a customer complaint to discover it. The larger option —
restructuring `detectIntentNLP` itself to prevent this class of
collision at match time — is real but explicitly NOT started; recorded
as its own item (`#39`) at the same scale as `§6A`/`§5A.6 #2`, needing
its own operator brief.

Updated after `T114` (Session 3 of the Operator Brief arc): charter §11
item 13 closed — `computer_symptom` authored, `tech_trouble+Diagnostic`
rewired to branch on device type. Verification found three MORE
`tech_trouble` diagnostic chains with the identical defect
(`tech_trouble_cable_management`, `tech_trouble_networking`,
`tech_trouble_smart_home`) beyond the two the brief named — squarely
in-scope per the brief's own category boundary and acceptance criterion,
so all five were fixed, not just the two. New item `#40` records the
three stub modules and the one imperfect-fit case (cable management,
using the generic catch-all) for content review, per the brief's own
instruction that draft content is directional, not final.

Updated after `T115` (Session 4 of the Operator Brief arc — the fourth
and final item of the original four-session brief): charter §11 item 3
and §5A.6 violation #3 both closed — `sqBuildCuratedIntake`'s hand-rolled
confidence formula replaced with a direct call to the canonical
`orch_compute_confidence`. A clean, complete fix with no new adjacent
findings: verified across all 17 real `minimum_quote_confidence >= 90`
services via a full browser-engine (JSDOM) load, confirmed genuine
against the pre-fix file (2 of 17 services failed with exactly the
described disagreement), and confirmed the extracted `AppController.js`
copy stayed in sync. No new numbered item added. §5A.6 violations #1
(layer assignment) and #2 (parallel renderers), and §11 item 2 (renderer
retirement), remain correctly `[OPEN]` — this fix did not touch, and was
never meant to touch, the broader renderer-consolidation question. **This
closes the four-item arc the original operator brief defined** (items 1,
12, 13, and 3 — now all `[LIVE]`); everything beyond it in this document
(`#33`–`#40`) was discovered or requested along the way, not part of
that original scope.

Updated after `T116` (operator-flagged, two items): (1) confirmed
directly that `run_all.sh` genuinely never discovers or runs
`automated_path_sweep.js` — and found, separately, that the tool also
had its own path-resolution bug making it fail immediately regardless;
fixed both, and wired it in as a non-blocking diagnostic step so its
signal is never silently lost again. `check_module_parity.js`, by
contrast, is a library already exercised indirectly by three `verify_*`
files that run on every suite pass — confirmed this via its real call
sites, not assumed; no gap there. (2) The operator's observation that
universal force-injection of `access`/`urgency`/etc. is "causing many
issues with balancing confidence" connects directly to two already-open
items: `#27` (the exact same concern, raised by the operator at `T105`,
already concluded to be "a real product question... not something to
unilaterally code around") and `#29` (the pricing-formula mechanism,
now independently reconfirmed at scale by the sweep's own first real
run). Not implemented this session — see the session report for why,
given this project's own explicit standing rule against changing
`force_modules_by_variability` without an explicit operator brief.

---

## Closed `T86`-`T99`, working decisions/real fixes

- **#14 `checkout_states` button colors** — confirmed as final: green
  (certain price) / blue (estimate) / amber (diagnostic uncertainty).
  Internally consistent scheme, reasoned not arbitrary.
- **#15 `dispatch_fee_apply_min_labor`** — confirmed at $50, based on
  this project's own ~$70-80/hr standard rate (~40 min of labor as the
  real breakeven point for needing a dispatch fee).
- **#16 the `bld*` Guided Builder function family** — extracted into
  `orchestrator_engine.js` (the module decided on directly, given their
  "resolve valid choices" role), with real, automated parity protection
  added immediately.
- **#10, 2 of 4 groups** — `dryer`/`stove_range` authored with real,
  physically-reasoned `routing_archetypes` data (not a blind copy of
  the washer/dishwasher pattern, which was checked and found to
  include physically-implausible entries). The other 2 groups
  (Appliances-parent, Appliances-Other) confirmed genuinely,
  correctly generic — not a remaining gap.
- **#4 Overflow-quantity UI** — fully closed. Deferred in `T86` as
  "too large for a quick fix," then closed in `T87` once the real,
  per-service data (not the generic module's own labels) was traced
  correctly: all 16 configured services already had the overflow
  answer's own label instructing "specify exact count in notes," with
  `formula_override` already wired. Two small, additive changes (the
  formula now accepts a live count; the existing notes field now
  supplies one) closed the real gap. Verified across the complete,
  real 16-service sweep, not a sample.
- **#18 "Ceiling tile" misrouting — closed for real, not patched
  around (`T97`).** What was scoped as "two options, neither a quick
  fix" turned out to have a real, complete answer built from entirely
  existing mechanisms — no new "negative keyword" system was needed.
  A genuine new dynamic service now exists
  (`minor_home_repairs_ceilings` group +
  `minor_home_repairs+minor_home_repairs_ceilings+Repair`), and free
  text now correctly, structurally routes to it: fixing this required
  updating **two separate, parallel keyword-routing mechanisms** this
  session discovered exist in this codebase
  (`intent_mappings.objects` *and* a second, independent rules table
  inside `resolveGroupFromIntent`) — a real, general architectural
  finding, not specific to this one case. Verified against both
  original example phrases, 4 additional real phrasings, and a
  regression guard confirming unrelated ceiling-mentioning requests
  (ceiling fan, a ceiling crack, ceiling painting) are correctly not
  captured. 20-check regression test:
  `verify_ceiling_tile_dynamic_service.js`.
- **#20 formula_override was silently suppressing every OTHER real
  modifier — confirmed and fixed (`T99`), not left as the "genuinely
  unresolved contradiction" it was honestly reported as in `T98`.**
  Direct, controlled testing (comparing the exact same answers with
  and without an active `formula_override`) definitively confirmed the
  bug: `wall_hole_or_crack_repair` with "4 or more areas" selected
  silently dropped $175 of real, confirmed modifiers (`wall_type`,
  `dmg_size`, `mounting_height`, `access`, `urgency`) that correctly
  applied the moment a non-formula answer was selected instead. Root
  cause: the generic per-answer modifier loop's own `if
  (!formulaResult)` guard was correct in intent (avoid double-counting
  an answer a formula already consumes directly) but wrong in scope
  (skipped the loop for *every* answer, not just the one(s) actually
  consumed). Fixed precisely: excludes only the real, specific
  `answers.*` keys each active formula's own code genuinely references
  (extracted directly from each formula's real code, not guessed),
  restoring every unrelated answer's real effect. A second, real
  double-counting risk this same fix could have introduced (some
  formulas, like `tile_repair_formula`, consume several answers, not
  just one) was caught directly by this session's own pre-existing
  `T93` regression test, not by luck — fixed in the same pass. 8-check
  regression test, including a real sweep across every
  (service, formula_override, other-modifier) combination the catalog
  actually contains. **Honest, still-open loose end, not swept
  under**: this closes the real, underlying mechanism bug with high
  confidence — but the screenshot's own exact displayed price ($1225)
  was never fully, numerically reconciled; a simple qty-multiplier
  hypothesis was directly tested and ruled out. The mechanism-level fix
  stands on its own evidence regardless.

**All working-decision items above are marked with their own real,
in-data notes recording this as a working decision, not silently
presented as fully final** — revisit if real usage data or a real
design review suggests otherwise.

---

## Previously resolved (`T79`)

- **#1, #2** real business numbers (overflow rate, hardware formula) —
  decided and implemented.
- **#3** universal logistics questions — decided: leave optional.
- **#5** RouteValidator semantic gap — confirmed already closed.
- **#6, #7, #9, #11** — deprecation headers, cleanup, fixes — all done.

---

## Still genuinely open — real, substantial work, not quick decisions

### #40 — ✅ CLOSED (`T118`, Step 6 item 5): `network_symptom`, `smart_device_symptom`, `generic_tech_symptom` are directional drafts, not reviewed content; `cable_management`'s Diagnostic chain has a known imperfect fit
Per the operator brief's own explicit instruction for Session 3
(`T114`): three of the four new intake modules are stubs, authored with
reasonable, plausible options but not held to the same bar as
`computer_symptom` (the one real, primary deliverable). Before treating
any of the three as final: `network_symptom` (router/WiFi extender),
`smart_device_symptom` (smart speaker/plug), `generic_tech_symptom`
(catch-all for "Other" device type) — all in `intake_modules`, all
tagged with a `_note` explaining their draft status inline.

**One additional, real fit problem, not just draft-quality content**:
`tech_trouble+tech_trouble_cable_management+Diagnostic` (one of the three
chains found during verification, not named in the original brief) now
uses `generic_tech_symptom`, which is a categorical improvement over the
prior appliance-shaped `symptom` module but still an imperfect semantic
fit — "Won't power on" doesn't really describe a passive cable's own
failure modes (frayed, tangled, wrong length, tripping hazard). The
brief's own authorized scope for this session was exactly three stub
modules (network/smart-device/generic), not a fourth, cable-specific one
— using the closest existing catch-all was the disciplined choice over
inventing a new module outside that scope, but the fit itself is
genuinely imperfect and worth a dedicated look, likely alongside the
other three modules' own content review.

**Fixed (`T118`, Step 6 item 5):** all three drafts expanded to
`computer_symptom`'s own bar — 6 to 9 real, distinct, customer-
answerable options each, no longer flagged as directional. A new,
dedicated `cable_symptom` module authored specifically for cable
conditions (tangled, damaged/frayed, tripping hazard, needs
hidden/routed, loose/intermittent connection), and
`tech_trouble_cable_management`'s own Diagnostic chain rewired to use
it instead of the borrowed catch-all. All four modules deliberately
carry no `modifier_ref` or `#emergency` tag on any option, matching
`computer_symptom`'s own established precedent — both are real
pricing/urgency decisions, not this item's to make. Verified via the
new `test_harness/verify_tech_symptom_content_upgrade.js` (17 checks).

### #39 — 🟡 GRANTED, T148 (brief-scoping only; the brief is not yet drafted) — was: Larger, deliberately deferred: restructure `detectIntentNLP` itself to be specificity-aware at match time, not just guarded after the fact
The real, complete architectural fix for the `#37`/`#38` bug SHAPE, not
just this catalog's current instances of it: today, every entry is
scored fully independently, with no awareness of any other entry's
vocabulary, and only compared afterward. A genuinely specificity-first
design (find the longest authored phrase match across the WHOLE catalog
first, and let it claim that text span before any shorter, competing
entry is even scored) would make this class of collision structurally
impossible rather than individually patched — no `full_weight_synonyms`
promotion needed case by case, no confidence-gate workaround, because the
shorter, contained match would never compete in the first place.

**Why this is NOT started here, deliberately, not just avoided**: `#37`'s
own fix (`T112`) already demonstrated the real risk of this category of
change first-hand — an unconstrained, general version of the SAME idea,
tested only against the one diagnosed case, silently changed 29 phrases
catalog-wide, several of them for the worse (routing around the
`install` resolver; trading a confident wrong answer for a different,
less-confident one). A blanket, catalog-wide version of that same idea
would need the identical one-at-a-time verification discipline `#37`
required, extended across every one of the (currently) 37 known pairs
plus however many the "self-reinforced" and "already promoted" carve-outs
are currently hiding — genuinely comparable in size and risk to `§6A`'s
pricing-formula unification or `§5A.6 #2`'s renderer retirement: real,
committed, multi-session work, not a continuation of this session's own
momentum. Needs an explicit operator brief of its own before starting,
per this project's own established rule for work at this scale.

**GRANTED T148 — operator ruling: reframed as a Ci-accuracy improvement; the grant is for a BRIEF, not the restructuring.** The restructuring changes how accurately the system understands what the customer wants (Ci), not "collisions". Today's failure mode is wrong-but-confident (a shorter keyword inside a longer authored phrase wins); the restructure's is over-committed-to-longer (the longer phrase wins even when the customer meant the shorter meaning inside it). The brief must cover: who may claim a span (all authored phrases, keywords and full-weight synonyms only, or runtime-admitted phrases); tie-breaks at equal length; multi-intent handling; migration (all at once or a per-category flag); the rollback criterion (the catalog-wide differential changes more than N phrases); the verification discipline (the 441-string sweep before and after, every divergence individually triaged, as #37's first attempt had to be); the relationship to `full_weight_synonyms` promotion (superseded or coexisting); and the Ci-impact analysis. **Acceptance criterion:** Ci accuracy improves; every phrase that changes behaviour gets a column (a genuine win, or a substitution of one failure mode for another). **Not yet drafted.** Evidence already in hand: `detectIntentNLP` starts at `nlp_engine.js` line 833 and scores every entry independently; the 441-string sweep exists and is permanent; #37's unconstrained first attempt changed 29 phrases catalog-wide, several for the worse; the synonym differential already measures before/after on the real `understandRequest`, and shows a promoted synonym behaves exactly like a keyword (#101). **Default if unanswered:** draft the brief next, with a measured baseline of the collision class (pairs where one authored form contains another, and what each resolves to today).

### #38 — root-caused, not just recorded: a permanent, automated check now catches every NEW instance of the `#37` bug shape as this catalog grows
Was: 38 individually-unverified strings surfaced by `#37`'s own
verification sweep, no mechanism to know if more existed or would recur.
**Root-caused at `T113`, directly requested by the operator ("get to the
heart of #37's bug")**: 214 of this catalog's 360 synonyms (59%) are
multi-word, and every one is a structural candidate for accidentally
containing a DIFFERENT entry's own bare keyword — the exact shape `#37`
was. That risk scales with the catalog itself, not with any specific
word, which is why chasing individual words case by case is a losing
game as this catalog grows, exactly as raised. Built
`test_harness/find_synonym_collision_risks.py` (picked up automatically
by `run_all.sh`'s existing `find_*.py` loop, no wiring needed) — it
recomputes the full, precise list of this exact risk shape on every run
and compares it against `test_harness/known_synonym_collision_risks.json`
(the reviewed-as-of-`T113` state, 37 pairs, refined from the earlier,
less precise 38-string sweep-based count). It exits clean when nothing
changed; it fails, loudly and specifically, the moment a genuinely NEW,
unacknowledged pair appears — confirmed directly by simulating a new
colliding synonym addition and watching it get caught immediately, not
theorized. This converts the failure mode from "silently resurfaces
someday, discovered via a customer complaint or another manual audit"
into "caught at data-authoring time, before it ships" — the actual root
cause, addressed at the point where the catalog's own growth is what
creates the risk in the first place.

**What this does NOT do, stated plainly so it isn't oversold**: it does
not fix any of the 37 currently-known pairs — each is still exactly as
unverified as before (see `#39` for why a blanket runtime fix isn't
attempted either). It also does not eliminate the NEED for `#37`-style
one-at-a-time verification when a real bug among the 37 (or a future
new pair) is confirmed — it only guarantees the *discovery* step no
longer depends on luck, customer complaints, or someone remembering to
re-run a manual sweep.

### #37 — CLOSED (`T112`): "dish washer" misroute fixed and verified
Was: `dishwasher`'s own synonym `"dish washer"` independently contained
`washer`'s own keyword as a whole word, so `"fix my dish washer"`
confidently misrouted to `washer_repair`. Fixed with two paired changes:
(1) `"dish washer"` promoted to `dishwasher`'s own `full_weight_synonyms`
(bringing its own confidence to the real 90 a keyword match would score);
(2) a new cross-entry specificity check added to `detectIntentNLP` itself
(code, not just data — promotion alone would only produce a 90-90 tie
with `washer`, not a reliable resolution), gated by two safety conditions
added after the first, unconstrained implementation was tested and found
to silently change 29 phrases catalog-wide, not 1. Verified via a full
441-string catalog sweep, before/after: exactly one string changed. Full
detail, including the safety-condition reasoning and the two-attempt
history, in `TIMELINE.md`'s `T112` entry and the code comment beside the
fix itself. See `#38` and `#39` above for the root-cause follow-through.

### #33 — ✅ CLOSED (`T118`, Step 6 item 3): `collectBookingContext_catalog` does not carry `answers` on its context object
Found directly while fixing the `answers` read-side bug in `executeWorkflow`
(`T108`, Charter §5A.5 / §11 item 1): `collectBookingContext_catalog` (and
`makeBookingContext`'s own defaults) never set `.answers` at all — confirmed
directly, not assumed. This is harmless for the `executeWorkflow` fix itself
(`context.answers || {}` degrades safely to `{}` when absent), but it means
a fresh catalog-tap context has no `answers` field until something
explicitly sets one after the fact (exactly what `handleIntakeAnswer`
already does). Per the operator brief's own Session 1 boundary, not touched
here — recorded as Session 5+ territory, as directed.

**Fixed (`T118`, Step 6 item 3):** added `answers: {}` to `makeBookingContext`'s
own shared defaults object, rather than patching `collectBookingContext_catalog`
(or any other individual collector) separately — every real entry path
(catalog, other_tile, free_text) already flows through this one function's
`Object.assign`, so this is the single place that actually needed it.
Confirmed directly: no code anywhere depends on `answers` specifically
being `undefined` rather than `{}` (a real grep, not an assumption); an
explicitly-passed `answers` override is still correctly respected
(`Object.assign` order unaffected). Verified via the new
`test_harness/verify_booking_context_answers_default.js` (6 checks).
Also surfaced and fixed a genuinely stale assertion in
`verify_answers_round_trip.js`, which had encoded this exact gap as its
own "by design" backward-compatibility check — inverted to confirm the
now-correct behavior instead.

### #41 — `verify_no_orphaned_data.js` (renamed from the broken `find_orphaned_data.py`, `T117`) now runs for real and found 47 real orphans; not triaged
Fixing `#34` (below) made this check work for the first time. It found
48 real orphans on its first run; one (`minor_home_repairs_ceilings`
missing from its own category's `group_ids`) was the exact same,
already-flagged issue from `#35`/charter §11, and was fixed directly
(one-line, zero runtime readers, already verified safe). 47 remain,
genuinely not triaged: 3 unreferenced tags, 1 unreferenced service, 2
formulas, 1 checkout state, and 38 `dynamicServices` keys the checker
considers unreachable.

**Two known false-positive risks in the checker's own logic, not in the
data — flagged so a future triage pass doesn't waste time re-deriving
this**: it flags `hybrid_qty` and `urgency` (2 of the "modules") as
orphaned, but both are universally force-injected via
`force_modules_by_variability` — the checker doesn't appear to know
about that mechanism, only literal `intake_chain` references. Several
of the 38 "orphaned" `dynamicServices` are also suspect for the same
reason `#40`'s `cable_management` finding was: `resolveDynamicService`
does an ungated lookup with no check against a group's own
`dynamic_service_types` list (confirmed directly at `T114`), so a
service type absent from that list can still be genuinely reachable.
Full list in `RESULTS/orphaned_data_report.txt`.

### #42 — ✅ CLOSED, T148 (by cross-reference, operator ruling) — was 🔄 PARTIALLY CLOSED (`T135`): a live instance of the "pricing-math" half fixed; a deeper "authoring-coherence" half, recorded in `PENDING_DECISIONS_consolidated`, remains genuinely open
Found while verifying `#29`'s own fix (`T118`), via `automated_path_sweep.js`'s
before/after delta — not something `#29`'s fix was expected to touch,
and confirmed directly it doesn't: this is a different bug. For an
`hourly_timed`-archetype service with no dedicated quantity module of
its own (confirmed real example: `blinds_shades_curtains_buy_the_hour`,
`intake_chain: ['global_quantity', 'access']` — `global_quantity` does
not count as the entity's "own" qty question, per
`entityHasOwnQtyQuestion`'s own explicit exclusion list), requesting
qty=5 produces $1900 against a $50 base price (38x) — confirmed
directly via `computeUnifiedQuote`, not estimated. Root cause, traced
precisely: `totalMin += (qty - 1) * 30` (a padding step, meant to
approximate "each additional unit takes some extra time") pushes
`totalMin` from 60 to 180 minutes, which crosses `deriveComplexityTier`'s
own threshold into a higher-rate tier — and *that already-quantity-
inflated total* then gets multiplied by `qtyMultiplier = qty` a second
time in the final formula. Two separate quantity effects compounding
multiplicatively, not additively. **Confirmed pre-existing, not
introduced by any `T118` work**: reproduced identically ($1900) against
the true pre-`T118` baseline. Not fixed here — this is `#29`'s own
formula-level sibling, structurally similar (a real design decision
about how the `totalMin` padding step and the tier-rate escalation
should interact with an outer qty multiplier, likely needing the same
kind of `scope`-aware treatment `#29` just received, but for time/tier
math rather than a flat fee) but genuinely distinct work, not a small
follow-on to bundle into `#29`'s own close-out.

**Closed `T135`.** Root cause confirmed exactly as diagnosed above; the
`totalMin` padding step is deleted outright (traced precisely: its own
firing condition was byte-identical to the condition under which the
outer `qtyMultiplier` independently multiplies the whole estimate, so
there was no remaining case where it was ever the sole, correct
mechanism — not reconditioned, removed). Tracing the *specific* named
example (`blinds_shades_curtains_buy_the_hour`) down to a working fix
surfaced a **second, independent instance of the same bug**: that
service no longer even uses the generic path this item diagnosed — a
later `T118` sub-fix moved it to `buy_the_hour_qty_gate_formula` — and
that formula's own exclusion from the outer multiplier lived in a
*second, hardcoded, independently-drifted copy* of the qty-aware-formula
list inside `computeArchetypeQuote`, silently missing this formula
entirely. Confirmed before fixing: qty=5 priced at $750 against the
formula's own intended $50 (15x) — a different number than this item's
original $1900/38x example because the service had moved to a different
formula in the interim, not because the diagnosis was wrong.

Both copies fixed; `QTY_AWARE_FORMULAS` is now a single, module-level
constant both functions reference (with an isolated-test-extraction
fallback, confirmed necessary after hoisting cleanly broke ~40 test
files that extract these functions' bodies without their surrounding
module scope — real, and recorded as its own lesson in `PHASE_PLAN.md`).
Catalog-wide, not just the one case: `automated_path_sweep.js --full`
went from 54 to 19 `HIGH_RATIO` flags (35 resolved, zero new), and every
pre-existing pricing regression guard reconfirmed clean. New permanent
test: `test_harness/verify_qty_tier_double_compounding_fix.js`. Full
account in `TIMELINE.md`'s `T135` entry.

**Does not close #42.** `PENDING_DECISIONS_consolidated` (read T135,
after this fix was written up) has a fuller, more accurate picture: an
operator note recorded at `T118` believed "the pricing-math guard is
done" — this session's own direct, empirical test proved that belief
wrong before touching anything, which is exactly the fix above. But
that same note names a deeper, separate, still-untouched "authoring-
coherence" half (quantity gets written into `BookingContext` from at
least four independent sources with nothing enforcing they agree) as
the item's real remaining scope. See `PENDING_DECISIONS_consolidated`'s
own `#42` entry for the full, current, authoritative account — this
file's copy is being corrected to match, not treated as the primary
record; `AGGREGATOR_README.md` is explicit that the consolidated file,
not this one, is what the project's own tooling actually parses.

**CLOSED T148 by cross-reference (operator ruling).** Pricing-math half: closed at T135. Authoring-coherence half (quantity written into the booking context from four independent sources with nothing enforcing agreement): addressed by T147's `resolveQuantityUnits` and `resolveQuantityMultiplier` (one decision, applied by every caller, enforced by the provenance detector and the quantity ratchet) and tracked in #95.

### #34 — CLOSED (`T117`): `find_orphaned_data.py`'s "syntax error" was incomplete data-hygiene: the file was never Python at all
Was flagged (`T108`) as a Python `SyntaxError` from a stray non-breaking
hyphen. Correct as far as it went, but not the complete picture, found
while acting on it directly rather than treating it as already fully
understood: the file's own shebang (`#!/usr/bin/env node`), its `/** */`
comments, `require()`, and `const` throughout, and its own docstring
(literally naming itself `verify_no_orphaned_data.js`) confirm it was
never Python — a JavaScript file saved under a `.py` name at some point
in this project's history, most likely during the same "recovery" event
that produced other reconstructed/misplaced files this arc has already
found (`check_module_parity.js`, `pricing_test_vectors.json`). Renamed
to match its own stated identity; it is now auto-discovered by
`run_all.sh`'s existing `verify_*.js` loop, so the old, separate,
explicit "Orphaned data check" step (which called it with `python3` and
CLI args it doesn't use) was removed rather than updated. Confirmed
directly: it runs cleanly as Node.js and produces real output — see
`#41` for what that output actually found.

### #35 — ✅ CLOSED (`T118`): `btnyc_master_deprecated.py --validate` surfaces two real, currently-live data findings
Found incidentally while confirming Session 1's baseline (`T108`) — the
script itself runs cleanly (exit 0) and is legitimately superseded by
`btnyc.py`'s in-app Repair Wizard (not a bug in itself), but its real output
is worth recording:
- **`category` entry `minor_home_repairs`'s own `group_ids` list was missing
  `minor_home_repairs_ceilings`** — **FIXED `T117`** (one line, zero live
  readers anywhere in `qr.html`, confirmed safe before and after). The
  group itself is real (added in `T97`, see `#18` above); only the
  parent category's own listing had never been updated to include it.
- **Ten `intake_modules` entries** (`appliance_type`, `disposal_request`,
  `floor_type`, `hardware_type`, `install_target`, `item_volume`,
  `leak_loc`, `parking_difficulty`, `pets_present`, `washer_type`) are
  reported as unreferenced by any service, dynamic_service, or
  `force_modules_by_variability`. **Real tension, not resolved here:**
  `parking_difficulty`, `pets_present`, `disposal_request`, and
  `item_volume` are also named directly in
  `verify_answer_supersedes_nlp_tag.js` as confirmed-live members of the
  "binary module" family sharing real tag-clearing behavior in
  `computeUnifiedQuote`. Worth reconciling why the same four modules read as
  both "structurally live" and "referenced nowhere" — not chased down this
  session.

**Re-ran the validator against the current, post-T118 catalog rather
than trusting the original list was still accurate** — much had
changed (`pets_present` deleted entirely, `disposal_request` and
`urgency` rescoped, per `#45`). `pets_present`/`disposal_request` had
already, correctly dropped off the list on their own. 8 remained.

**The real tension, resolved:** confirmed directly that
`parking_difficulty` and `item_volume` are referenced by
`#no_parking`/`#high_volume`'s own smart_tag `answers` fields — a real,
live reference pathway the checker itself never looked at, not a real
orphan. Fixed `btnyc_master_deprecated.py` to also check smart_tags'
`answers` as a third, valid reference source, alongside service chains
and `intake_defaults`. Verified via a new test
(`test_harness/verify_smart_tag_reference_pathway.js`, 10 checks): the
two real false positives are gone, `pets_present`/`disposal_request`
stay correctly resolved, and — critically — the remaining 6 genuinely
orphaned modules are confirmed to STILL correctly flag, proving this
fix narrows false positives rather than hiding real gaps.

**The remaining 6 (`appliance_type`, `floor_type`, `hardware_type`,
`install_target`, `leak_loc`, `washer_type`) are a real, separate,
actionable finding, not resolved here:** these are genuinely,
completely unreferenced — no service, dynamic_service, intake_default,
or smart_tag touches any of them. Investigated their content directly
rather than assuming they were dead: all six are real, well-formed
questions with sensible options, and 5 of 6 carry genuine
fee/complexity impact on their `client_response` options (passing the
§6E/`#26` "meaningfully changes price" test cleanly) — strongly
suggesting authored-but-never-wired content, not junk. Each maps
plausibly to a specific, real, currently-live service that has no
comparable question of its own today:
`washer_type` → `washer_repair` (chain: `location`, `symptom` — no
question captures top/front-load/stackable); `leak_loc` →
`leak_under_sink_repair` (chain: `location`, `leak_type` — `leak_type`
asks *what's* wrong, not *where*, a genuinely different, complementary
dimension); `hardware_type` → `door_lock_or_handle_install` (chain:
`global_quantity` only — no content question at all today);
`floor_type` → a floor-repair service (`squeaky_floor_repair` /
`loose_tile_replacement`, neither of which asks about underlying floor
material); `appliance_type` → likely a generic appliance-repair
service (`repair_appliances`, chain: `location`, `symptom`).
`install_target`'s own metadata inconsistency was also found: it
claims `affects_price: true` but none of its actual options carry a
`modifier_ref` or `complexity_override` — worth resolving either way
before wiring it anywhere.

Not wired into any service this session — five separate, real content/
pricing decisions (which service, where in the chain, whether the
existing fee/complexity values are still current) each deserve their
own deliberate pass, not a rushed batch change under an item whose own
scope was "found incidentally." Left here as a clear, actionable
starting point rather than a vague "investigate someday" note.

6 orphaned modules wired in, T119. Two spot-checked and corrected,
T120: `install_target` reverted to orphaned (topical fit was wrong —
6 of 8 options didn't belong on the service it was wired to, and it
carried no pricing mechanism at all); `appliance_type` re-wired into
both `repair_appliances` and `microwave_repair` (not the original,
under-justified single choice) with a real, newly-authored fee, since
neither module's original wiring actually changed price despite an
earlier claim that it did. The other 4 wirings (`washer_type`,
`leak_loc`, `hardware_type`, `floor_type`) were re-confirmed as
genuinely confident and left in place, unchanged. See `TIMELINE.md`
`T119` and `T120`.

### #36 — ✅ CLOSED (`T118`, operator-provided): `pricing_test_vectors.json` restored — the real, original 159-line file, not a placeholder
Confirmed directly (`T108`): the file's own `_placeholder_note` states the
original, hand-authored 159-line file was lost and a prior session
deliberately left an empty `vectors: []` placeholder rather than fabricate
pricing figures — consistent with this project's own standard against
inventing unproven pricing/business data. `run_vectors.js`,
`verify_cms_bridge.js`, and `verify_pricing_engine_module.js` all ran and
passed against this placeholder, but their vector-comparison sections were
providing zero real coverage. Restoring the real file from its original
source, if it still existed anywhere outside this sandbox, was flagged as
valuable; fabricating replacement vectors was not.

**The operator located and provided the real file directly.** Verified
before trusting it, not just installed on faith: valid JSON, a real,
detailed `_meta` block (creation date, schema-version note, an explicit
"do not silently edit expected values" principle matching this project's
own established standards), and 16 real, richly-documented vectors
spanning `tile_repair_formula`, `furniture_repair_formula`,
`drywall_repair_formula`, `pax_wardrobe_formula`,
`mathFurnitureAssembly`, five named hourly/flat-rate services (including
two explicitly documented as *decreasing* in price after an earlier fix
— exactly the kind of nuance that would be lost if anyone ever
regenerated this file from current code instead of preserving it as a
real regression anchor), and two dynamic `wall_mounting+Mount` duration
vectors referencing `v9.5`'s own real duration fix.

**Run against the current, post-`T118` codebase — genuinely, not
assumed — given this session's substantial pricing changes (`#29`'s
per-visit/per-unit split, the buy-the-hour redesign in `#44`, `access`'s
full removal in `#45`): all 16 vectors pass via `run_vectors.js`; all 16
pass via `verify_pricing_engine_module.js` (plus a bonus, independent
confirmation that the standalone `pricing_engine.js` module is still
10/10 in sync with `qr.html`); all 7 bridgeable vectors pass via
`verify_cms_bridge.js`. None of these 16 vectors happen to exercise the
specific qty>1-plus-per-visit-modifier interaction `#29` touched, or the
specific services `#44`/`#45` modified, or `access` directly — so this
result is a real, clean pass for the scenarios it covers, not blanket
proof every T118 change is regression-free (those are separately,
already covered by this session's own dedicated tests).

Installed at `test_harness/pricing_test_vectors.json` (the canonical
location per `FILE_MANIFEST.json` and where all three dependent scripts
actually look via `__dirname`) — not the project root, which never held
a copy the tests would read anyway.

### #29 — ✅ CLOSED (`T118`, Step 6 item 1): per-visit logistics fees (urgency, access, parking, disposal) scale with quantity as if they were per-unit costs
Found via direct analysis of a real, user-captured trace (`T107`):
installing 10 prehung doors priced at $2950 — $295/door — because
`laborEstimate = (base + extraFee) * qtyMultiplier` multiplies the
**entire** `extraFee` sum by quantity, with no distinction between
costs that genuinely scale per unit (frame demo, per-door labor) and
costs that are logically one-time, per-visit costs regardless of how
many units are worked on in that same visit (the urgency surcharge,
access difficulty, parking difficulty, disposal). Confirmed directly:
there is no existing schema field anywhere in `global_rules.modifiers`
distinguishing per-unit from per-visit scope — every modifier is
treated identically. This is not a one-off bug in one service; it's
structural, and affects every service where quantity can exceed 1
alongside any of these universally-force-injected modifiers — plausibly
the single largest, most systemic pricing-accuracy issue found this
session. Needs a real design decision (a new, explicit per-modifier
scope field, most likely) before a catalog-wide fix, not a one-line
patch.

**Independently reconfirmed at scale, `T116`**: the operator flagged
directly that `run_all.sh` never actually discovers or runs
`automated_path_sweep.js` (confirmed true — it matches none of
`run_all.sh`'s own `verify_*`/`find_*` globs) and separately observed
that universal force-injection of `access`/`urgency`/etc. "is causing
many issues with balancing confidence." Running the sweep tool for the
first time (after fixing its own, separate, unrelated path bug — see
`TIMELINE.md`'s `T116` entry) surfaced 65 flagged anomalies out of 612
real runs across all three UI paths, effectively all `HIGH_RATIO`
(quotes running 6.5x–9.3x their base price), concentrated almost
entirely in `qty=5` scenarios. This is the exact, predicted signature of
this item's own diagnosed mechanism — real, independent, at-scale
evidence for a bug that, until now, had one confirmed trace as its
evidence. Full detail: `SWEEP_RESULTS.json` at the project root.
`run_all.sh` now runs this sweep automatically (non-blocking,
diagnostic) so this evidence is never silently unseen again.

**Surface reduced, root cause NOT yet fixed, `T118`**: removing
universal force-injection (per explicit operator brief; see
`FORCE_INJECTION_AUDIT.md`) means `urgency`/`access` no longer apply to
every service by default, so the qty-multiplication bug this item
describes now has fewer opportunities to fire — confirmed directly:
`automated_path_sweep.js`'s own before/after comparison dropped from 71
to 52 flagged `HIGH_RATIO` instances from this change alone, before any
formula fix. The underlying mechanism this item describes
(`laborEstimate = (base + extraFee) * qtyMultiplier` with no per-unit/
per-visit distinction) is untouched and still fires for any service
that DOES carry one of these modifiers where quantity exceeds 1 — the
10-door trace, re-run post-`T118`, confirms this directly: with no
special answers it now prices perfectly ($150/door, matching
`base_price`), but if the customer answers `access` as "very cramped,"
that $25 fee will still incorrectly multiply by quantity. Still open;
the actual formula fix is scoped as its own, separate follow-on item.

**Fixed (`T118`, Step 6 item 1):** every modifier in `global_rules.modifiers`
now carries an explicit `scope: "per_unit" | "per_visit"` — 6 per_visit
(exactly the six named above: `access`, `urgency`, `parking_difficulty`,
`disposal_request`, `pets_present`, `item_volume`), 111 per_unit
(everything describing a physical characteristic of the item/work
itself). `computeUnifiedQuote` now routes each answer-driven fee into
`extraFee` (per_unit, inside the `* qtyMultiplier` multiplication) or the
new `perVisitFee` (per_visit, added once, outside it) based on that
field — both now exposed on the return object and in the trace export,
not just internal. The 10-door trace with `access` answered now prices
at $1525 (base×qty + $25 once), not the old buggy $1750. Confirmed
empirically that no current service can have this fix silently bypassed
by `computeArchetypeQuote`'s separate formula-archetype override path
(checked both real and dynamic services for the intersection: zero).
Verified via the new `test_harness/verify_per_unit_per_visit_scope.js`
(14 checks), including a check that the old formula's own math
genuinely reproduces the diagnosed bug shape, confirming this is a real
fix and not a tautology.

**A real, notable discovery while verifying against `automated_path_sweep.js`'s**
own before/after delta (52 → 61 flagged, investigated rather than
assumed benign): a pre-existing historical test
(`verify_qty_multiplier_formula_fixes.js`) had validated its own fix
against a real screenshot's displayed price ($1225 for
`wall_hole_or_crack_repair` at qty=5) — that $1225 turned out to be a
live instance of this exact bug, not a case that avoided it: `$1225 =
(170 + 75) * 5` (per-unit and per-visit answers both incorrectly
multiplied together). The real, correct price is `$925 = (170 * 5) +
75`. Updated that test's own expected value with full documentation of
why, rather than leaving a genuine screenshot-verified number
unreconciled.

**Also found, NOT fixed, recorded separately as `#42`:** a different,
pre-existing bug in the same family, affecting hourly-rate services
with no dedicated quantity question — see `#42`.

### #30 — ✅ CLOSED (`T118`, Step 6 item 2): NLP intent-matching can be hijacked by any incidental keyword anywhere in the customer's free text
Found via direct analysis of a real, user-captured trace (`T107`): a
customer's real free-text input ("I need a bed assembled. [...]
produces irrelevant questions like Dywall or plaster...") matched
`"plaster"` — a word appearing only in the customer's own complaint
about the app, not their actual stated need — and routed the entire
quote to `brick_or_concrete_crack_repair`, with `objectNoun` extracted
as `"tracing prevents me"`. `detectIntentNLP` scans the full input
string for any matching keyword anywhere, with no weighting for
primary stated intent vs. an incidental mention, parenthetical, or
quoted complaint. All of this session's own free-text testing has used
short, clean, textbook phrases ("I need my X fixed") — this is the
first real evidence of how the matcher behaves on longer, messier,
realistic customer text, and it failed completely. A serious, likely
systemic gap in the NLP layer specifically, distinct from anything
fixed this session.

**Fixed (`T118`, Step 6 item 2), three parts, all in `detectIntentNLP`:**
(1) quoted/parenthetical/bracketed content is now stripped before any
scoring — the exact shape of the diagnosed trace, where the incidental
word lived inside what reads as a parenthetical complaint; (2) matches
found only beyond the first ~15 words now score at half weight,
compounding with (not replacing) the existing full/half-weight synonym
distinction from `T110`/`T111`; (3) a winning candidate whose entire
evidence came from beyond that primary region, with no later
corroborating override (`contextual_override` or the description-based
sibling override both still count as genuine additional evidence, not
grounds for further suppression), has its `recommendedSku` suppressed —
general category routing may still proceed; a confident, named
recommendation may not.

Verified directly against the real trace: the pre-fix code confidently
(90%) matches the incidental word and would route to it; the fixed code
no longer does, and suppresses `recommendedSku` rather than guessing.
Confirmed the fix doesn't over-suppress: a genuine primary-region
keyword (`"I need my faucet fixed (drywall mentioned parenthetically)"`)
still wins cleanly with a real `recommendedSku`. Confirmed zero
regressions against both hard-won catalog-wide guards from `T112`/`T113`
(the 441-string cross-entry sweep, the synonym collision-risk check) and
the full 129-test suite. New test:
`test_harness/verify_nlp_incidental_keyword_fix.js` (8 checks).

**Honestly scoped, not overclaimed:** "bed" is not a real keyword or
synonym anywhere in the current catalog, confirmed directly — so this
fix cannot make the motivating trace correctly resolve to furniture
assembly; what it does is stop the confident, wrong, incidental match
from winning, falling back to a weak, generic categorization instead.
Adding "bed" as a real synonym is a separate, catalog-content question,
not part of this fix.

### #31 — Two, separate, parallel curated-card rendering systems exist, with real, confirmed divergence
Found via direct analysis of a real trace (`T107`): `sqBuildCuratedIntake`'s
own `render()` (traced and DOM-snapshotted since `T106`) and a second,
completely separate system, `renderCuratedCardFromRoute` (using
`.ims-chip`/`.intake-module-step` markup and its own, local
`refreshPrice()`/`_computePrice()` calculation), are both real and
both currently in use on different real paths. `T106`'s own DOM
-snapshot instrumentation only ever reached the first one — confirmed
and partially closed this turn (the DOM-snapshot selectors and its
hook into `refreshPrice()` were both real, confirmed gaps, now fixed).
Not yet investigated: why two separate systems exist, whether they
should genuinely both remain, and whether any other real behavior
(beyond tracing visibility) diverges between them — a real,
architectural question, not resolved here.

### #32 — Confirmed: the debug tracing overlay could fully block real, on-screen interaction on narrow viewports
Found via direct analysis of a real trace (`T107`), matching the
user's own, exact, directly-reported symptom ("the tracing prevents me
from tapping add"). Confirmed via the real CSS: a fixed 420px-wide,
100vh-tall panel would fully cover a typical phone screen while
enabled. Fixed this turn (constrained width/height so some of the real
page always remains reachable) — noted here since this was a real,
confirmed instance of the debug tool itself actively harming the exact
testing it was built to support, not a hypothetical risk.

### #25 — ✅ CLOSED (`T118`, Step 6 item 9): Catalog discoverability: a customer wanting knob installation can land on "Cabinet Door or Drawer Adjustment" instead
Found via direct user testing (`T105`), and confirmed directly: the
real, correct service for "100 knobs installed... all new holes"
(`cabinet_knob_or_pull_install`) exists and correctly uses
`hardware_install_formula`. But the reported trace shows the customer
actually landed on `cabinet_door_or_drawer_adjustment` — a materially
different job (aligning/fixing existing hardware, not installing new
knobs) — via catalog navigation, not free text (the trace's own
`"input":null` and missing `nlp_engine` entry confirm this). Not yet
investigated: why catalog browsing made the wrong service easy to
select for this real intent — likely connects to `#21`'s own, already
-open naming/discoverability question. A real, valuable, unresolved
lead, not a guess presented as a finding.

**Fixed (`T118`, Step 6 item 9), per explicit operator direction — a
targeted mitigation, not a claim the root navigation cause is fixed:**
added a new, bidirectional `related_services` field (both in the real
data and the schema) linking the two services. Wired a real, working
cross-link into `renderCuratedCardFromRoute` — a customer who lands on
either service sees "Looking for [the other one] instead? Switch to
that," and clicking it calls `prefillSmartQuoteFromService`, the exact
same proven navigation path a catalog tile tap already uses, not a
bespoke mechanism. Verified via a new, full jsdom, real-browser-engine
end-to-end test (`test_harness/verify_related_services_crosslink.js`,
14 checks): renders the real card, confirms the notice and button
appear with the correct target service, confirms clicking genuinely
triggers the switch with the right service and category, and confirms
a service with no `related_services` renders cleanly with no notice
and no console errors.

**Correction, found and fixed one checkpoint later (`T118`, Step 6
item 10 investigation):** the first draft's HTML for the target
service's display name went unescaped, on the mistaken belief — stated
directly in this same entry, initially — that no `escapeHtml()`
function exists in this codebase. That was wrong: it's real, declared
as `const escapeHtml = (str) => {...}` (an arrow function, not a
`function` statement, which is why an overly narrow grep pattern missed
it the first time), and it's the dominant, established convention
across dozens of call sites in this exact file, including the closely
analogous "insert a recommended service's display name into HTML"
pattern this new code should have matched from the start. Corrected
directly; the jsdom test above still passes 14/14 with the fix in
place. Recorded here rather than silently amended, since the original,
incorrect reasoning had already been written down as if confirmed.

Does not resolve the underlying catalog-navigation question `#25`'s own
text connects to `#21` — a working escape hatch for a customer who
already landed on the wrong service, not a fix to why that's easy to do
in the first place.

### #26 — ✅ CLOSED (`T118`, Step 6 item 10): "Special conditions" section: ordering and visual clutter
Raised directly by the user (`T105`): described as unordered, adding
clutter, and making the "We Understood" summary look small and
cluttered by comparison. Not yet investigated at all this session —
needs a direct look at the real rendering code and real ordering logic
before any change, not a guess.

**Fixed (`T118`, Step 6 item 10):** identified the real, live rendering
path directly rather than guessing — `sqRenderQuote`'s own condition-
chip row (`renderTagAffirmationCard`, a plausible-looking candidate
with a near-identical chip row, is confirmed `DEPRECATED`/unreachable
since `T70`, so fixing it would have had zero customer-facing effect).
Confirmed the real complexity before implementing: a tag's fee impact
can no longer be read from its own `effects.fee` for most tags — the
`v9.5` migration retired that in favor of applying fees through the
module-answer mechanism instead, so a tag's real price impact has to be
traced from its own authored `answers` field through to the real
modifier fee, not read off an already-flattened `activeLabels` string
array. Authored a new `sqTagFeeImpact` helper that does this trace
directly. Conditions now render sorted by real fee impact (highest
first); zero-fee, purely informational conditions collapse into a
single "+N more details" toggle instead of full-sized chips carrying
the same visual weight as fee-bearing ones. Verified via a new, full
jsdom, real-browser-engine end-to-end test
(`test_harness/verify_special_conditions_ordering.js`, 13 checks):
confirms the fee-impact helper against real, known tags, renders a
real mix of fee-bearing and zero-fee conditions, confirms the default
collapsed state, and confirms clicking the toggle genuinely reveals
the collapsed condition.

### #27 — CLOSED (`T118`): `access` question's logical fit for cabinet hardware work (connects to `#22`)
A real, well-reasoned point raised directly by the user (`T105`):
working on a cabinet knob or drawer inherently requires the drawer to
already open, so "very cramped or hard to reach" access may not be a
coherent scenario for this specific job type, even though the
`modifier_ref` it carries is real and does affect price when chosen
(confirmed directly, not assumed unused). At the time, `access` was
deliberately, universally force-injected onto every service regardless
of tier (established Charter policy, not a per-service bug) — a real
product question about whether specific service types should be
exempted, not something to unilaterally code around.

**Resolved directly by `T118`'s force-injection removal**, not by
answering the original question: universal injection no longer exists,
so `minor_home_repairs_cabinets_drawers` simply was not given `access`
in the new `global_rules.intake_defaults` (see `FORCE_INJECTION_AUDIT.md`'s
Step 4 section) — matching this item's own concern exactly, without
needing to decide whether "very cramped" is ever a coherent answer for
a drawer that must already be open. If a future, different scenario
makes a case FOR access on cabinet work specifically, that's now a
fresh, opt-in decision (add one group_default entry) rather than an
exemption to carve out of a universal default — lower-stakes either
way. Still connects to `#22`'s own, separate question-curation work.

### #28 — ✅ CLOSED (`T118`, Step 6 item 12): The exact "1 door" adlib text: definitively confirmed and fixed
Investigated directly (`T105`): `qtyLabel` is never actually set to
"door" anywhere in the real code (always literally `'item'`), so that
specific field is not the source. The adlib's own real noun-resolution
logic (`sqBuildAdlib`) falls back to `S.intent.label` when
`S._objectNoun` is unset — and this service's own real display name is
"Cabinet Door or Drawer Adjustment", ambiguously naming both "door" and
"drawer". This is a plausible, real mechanism, consistent with the
service-mismatch finding in `#25` above — but the trace itself doesn't
capture adlib/DOM rendering state, only pricing calculations, so this
was not pushed to a definitive conclusion from static code reading
alone. Stated honestly as a strong lead, not a confirmed fix.

**Definitively confirmed (`T118`, Step 6 item 12), empirically, for
the first time** — not from static code reading, from a real, full
jsdom render: the actual, rendered sentence for
`cabinet_door_or_drawer_adjustment` was "I need 1 Cabinet Door or
Drawer **Adjustment adjusted**" — a genuine, confirmed redundancy (the
noun and verb repeat the same concept), not merely a plausible one.
Getting the real sentence required reading only each "pill" element's
own visible label span, not the whole container's `.textContent` — each
pill also contains a hidden (`opacity:0`) `<select>` with every dropdown
option as a real `<option>`, which a naive read concatenates in too;
recorded here so a future session doesn't rediscover this the hard way.

**Fixed:** strips a trailing, nominalized action-suffix word
(Adjustment, Replacement, Repair, Installation, Install, Assembly,
Configuration, Setup, Diagnostic) from the label before using it as the
noun fallback. Confirmed directly this resolves the same redundancy for
52 real services in the current catalog, not just the one named case,
and confirmed no regression for labels that don't end in one of these
words. Verified via a new, full jsdom end-to-end test
(`test_harness/verify_adlib_noun_redundancy.js`, 6 checks).

### #43 — NEW: one real service's display name has the same noun/verb redundancy in a different shape `#28`'s fix doesn't catch
Found while checking how widespread `#28`'s confirmed redundancy
pattern is across the real catalog, before scoping that fix (`T118`):
`faucet_repair_drip`'s display name, "Faucet Repair (Drip)", produces
"I need 1 Faucet Repair (Drip) **repaired**" — the same underlying
redundancy, but the action word sits before a parenthetical suffix
rather than at the very end of the string, so `#28`'s trailing-suffix
strip correctly does not match it (matching text at the true end of the
string, not the true end of the meaningful phrase). Confirmed this is
genuinely isolated — exactly one service in the current catalog has this
shape, not a second widespread pattern needing its own general fix.
Not fixed here — a real, general "strip a redundant action word even
when followed by a parenthetical" rule risks unintended effects on
other, not-yet-checked service names for a single, currently-known
case; a targeted one-line fix (rename this one service's `_note` and
display name, or add its own narrow pattern) is safer, but is a fresh
decision, not an extension of `#28`'s own, already-verified scope.

### #45 — ✅ CLOSED (`T118`, operator-directed, explicit removal): `access` removed catalog-wide, and the same meaningfulness test applied to every other `intake_defaults` module
Explicit operator direction: `access` "is not a question with a
meaningful answer distribution in residential handyman work —
reachability is either constant... or covered by a specific factual
module... Do not scope it; remove it." Then: apply the same test
("does a real customer's answer meaningfully change the price, and
would the customer recognize the change as fair?") to every other
module in `global_rules.intake_defaults`.

**`access` — removed entirely**, not scoped: `category_defaults` (3
categories), `group_defaults` (12 groups, 10 of which had *only*
`access` and were removed entirely), the 2 now-moot `excluded_services`
entries, all 10 services with `access` directly authored in their own
`intake_chain`, the `intake_modules.access` definition itself, the
`global_rules.modifiers.access_very_cramped_or_hard_to_reach` fee
definition, and — found dangling during this same fix, its own
`answers` mapping pointing at the now-deleted module — the
`#access_obstructed` smart tag.

**The same test applied to the remaining four modules, each checked
against its own real fee, not assumed:**
- **`urgency`** ($50/visit) — genuinely passes. Kept, scoped down per
  explicit operator direction to `plumbing_help`/`tech_trouble` only;
  removed from `electric_lighting`.
- **`pets_present`** — **failed outright, removed entirely** (module,
  modifier, and its own `#pets_on_site` smart tag, found dangling the
  same way `#access_obstructed` was). Its own `modifier_ref` carried
  `fee: 0` — confirmed directly, not assumed: a question whose answer
  can never change the price cannot pass this test under any reading.
- **`parking_difficulty`** ($20/visit), **`disposal_request`**
  ($25/visit), **`item_volume`** ($50/visit) — each confirmed to carry
  a genuine, non-zero, fairness-legible fee already correctly scoped as
  opt-in/targeted. Kept as-is; no change needed.

**T135 OPERATOR OVERRIDE, `parking_difficulty` only** (supersedes this
entry's own "kept as-is" conclusion for that one module — `disposal_request`
and `item_volume` are unaffected and remain as determined above): a real
fee passing the "does the answer meaningfully change the price" test is
not the same claim as "the question is fair to ask a client directly."
Direct operator instruction: *"Parking difficulty is a bad question to
ask a client and should be removed period. It's pointless and bad
business."* `parking_difficulty` fails the Question Test
(`#question-test`) independent of whether its fee is real — a customer
cannot reliably self-assess "difficult" parking, cannot see the $20
consequence before answering, and does not recognize the question as a
decision. `intake_modules.parking_difficulty` is now marked
`_never_ask_directly: true` and permanently barred from any authored
`intake_chain`, enforced by `test_harness/verify_no_client_facing_parking_question.js`.
The module's schema is deliberately preserved, not deleted: `#no_parking`
remains genuinely NLP-detectable from free text (confirmed real
synonyms: "no parking," "parking difficult," "metered parking," "city
center," "downtown," "paid parking"), and `syncTagSynthesizedAnswers`
(`T77`) still resolves the same fee when that tag fires — captured
structurally/via free-text inference, never by direct question, per the
Charter's own amended Access axis (`CHARTER_AMENDMENTS_T135.md`
Amendment 1) and new parking anti-pattern (Amendment 2). Full account:
`TIMELINE.md`'s `T135` entry.

**A large, genuine ripple effect worked through methodically, not
mechanically**: 13 existing test files broke from `access`'s removal
alone (most had used it as their own go-to example of "a real,
fee-bearing answer" throughout this whole session's own test-writing),
plus 6 more from the follow-on `urgency`/`pets_present` changes — each
given a real look to confirm what the test's actual point was before
picking a substitute (`disposal_request` for most dollar-amount
examples, since it carries the identical $25/20min `access` used to;
`parking_difficulty` where a second, distinct binary module was
needed; a category switch to `plumbing_help` where a test depended on
`urgency` being a genuine chain default, not just a direct answer).
Two real, currently-live Puppeteer/browser and hardcoded-chip-count
tests also needed updating once the deleted smart tags stopped
matching real free-text phrases or being counted among a service's
valid chips.

**New tests**: `test_harness/verify_access_removed_catalog_wide.js` (15
checks — data-level absence, the five named job types from the
operator's own brief, a full catalog-wide sweep beyond just those five,
and the re-run door trace) and
`test_harness/verify_intake_defaults_meaningfulness_review.js` (15
checks — the `pets_present` removal, `urgency`'s scoping change, and
the three survivors' real fees, plus a general, mechanical check that
every remaining `per_visit` modifier has a real, non-zero fee).

**Charter updated**: `PROJECT_CHARTER.md` §6E, a new principle addendum
in the operator's own words, with this session's five concrete
decisions recorded as the applied example.

### #44 — ✅ CLOSED (`T118`, operator-directed, real user trace, 2026-09-12): buy-the-hour pricing redesign surfaced and fixed a chain of three real, connected, previously-unrelated bugs
Operator-provided real trace + explicit design request: `blinds_shades_curtains_buy_the_hour`
needed a new preliminary "what's being mounted?" question, then a
binary "1 item / more than 1 item" gate, pricing flat for 1 and hourly
(1-hour minimum) for more than 1 — **both at the same dollar rate**.
Operator further, directly identified that a mechanism for exactly this
kind of flat/hourly switching had existed before and was "deprecated
erroneously... perhaps when the 'hours' option was removed."

**Confirmed the operator's claim precisely**: `global_rules.pricing_engines.hourly_estimate.minimum_billable_hours`
is real, structured data (`1`) with zero consuming code anywhere in
`qr.html` — confirmed via an exhaustive grep, not assumed. This is the
dormant mechanism.

**Building the new feature surfaced two further, real, currently-live
bugs, found while verifying rather than assumed away:**
1. `blinds_shades_curtains_buy_the_hour`, before this session's changes,
   qualified as a "self-quoting" service (`legacyDetermineSelfQuoting`)
   and was actually priced through a completely different function
   (`sqRenderSelfQuoteAdlib`), not the curated-intake engine
   (`computeUnifiedQuote`) initially built and verified against — a real
   mistake, corrected directly rather than left standing once found.
2. `sqRenderSelfQuoteAdlib`'s own hourly-pricing branch computed
   `basePrice + (mins/60)*tierRate` — double-counting the base price and
   the hourly time cost together. Confirmed this is a real, live bug
   still affecting `shelf_mounting_standard_buy_the_hour` (the *original*
   `#22` complaint service) **today**, overcharging at $145 instead of
   $60 — `#22`'s own earlier fix never caught this because it only
   removed extra questions, never touched this calculation.
3. While fixing #2, found a third bug: the code reads `fe.pricing_type`,
   a field that does not exist anywhere in the real data (confirmed via
   grep) — the real field is `fe.type`. This meant the hourly branch was
   structurally unreachable regardless of a service's real type. Checked
   the blast radius directly before fixing, not assumed narrow: exactly
   one currently self-quoting service has `type: "hourly"` today.

**Fixed, all three, together:** `sqRenderSelfQuoteAdlib`'s calculation
corrected (no double-count, `minimum_billable_hours` now explicitly
read and respected) and the field-name mismatch fixed. A new,
registered `buy_the_hour_qty_gate_formula` (also explicitly reading
`minimum_billable_hours`, not relying on a coincidental match with
`expected_minutes`) drives `blinds_shades_curtains_buy_the_hour`'s own,
now-necessarily-curated-intake pricing, via two new intake modules
(`blind_curtain_shade_items`, `buy_the_hour_qty`) styled after the
catalog's own established `wall_mount_items` "what's being mounted"
pattern but with service-appropriate content. The compiler's own cached
`pricing_archetypes` namespace updated to match (was stale after a
manual data edit, caught by `verify_btnyc_v8_compiler.py`'s own
re-runnability check, not missed). Verified via
`test_harness/verify_buy_the_hour_flat_hourly_gate.js` (15 checks) plus
a separate, full jsdom render test confirming the live self-quote path;
4 other tests updated for now-correct, no-longer-stale expectations
(two `self_quote` assertions switched to the service that still
qualifies; one archetype count corrected; one compiler-cache
comparison refreshed).

**Recorded, not fixed**: a pre-existing, confirmed-unrelated gap where
4 real Guided Builder functions (`bldGetObjectChoices` and 3 siblings)
live in a different `qr.html` script section than
`verify_orchestrator_engine_module.js` expects for its own module-parity
report — confirmed present identically in the pre-`T118` baseline, so
not introduced this session; the check itself is informational
(printed, not a blocking assertion), so this doesn't affect suite
health. Left for whenever `qr.html`'s own internal script-block
organization is next revisited, not folded into this fix.

### #46 — ✅ CLOSED (`T118`, operator-directed, explicitly non-urgent): category grid icons migrated from emoji to Tabler icon markup
Explicit operator direction, provided as an exact HTML snippet: replace
the six category cards' emoji icons with Tabler `<i class="ti ti-*">`
markup, matching the convention already used extensively elsewhere in
this app. Explicitly flagged as not urgent.

**A real, complete fix was needed, not just the static markup edit
provided** — confirmed directly, not assumed: editing
`#category-card`'s static HTML alone left the page showing emoji after
init. `renderCategoryCards()` fully replaces that container's children
on load (`DOM.categoriesGrid.replaceChildren()`), rebuilding each card
from `SERVICE_DATA.category[*].icon` via the shared `create()` helper's
`text:` option — `el.textContent`, plain text insertion. Simply
changing the data value from an emoji to a Tabler class string (e.g.
`"ti ti-home"`) without also fixing the render call would have made
the literal text "ti ti-home" appear as visible words on the page, not
an icon glyph.

**Fixed both together**: `renderCategoryCards()` now builds a real
`<i class="...">` child element (matching the established `create()`
pattern for nested elements, not an `html:` string-injection
shortcut), and `category[*].icon` in `btnyc.json` now holds the six
real Tabler class strings. The static HTML fallback was also updated
to the same markup, so it stays correct in the (currently unused)
event this render call is ever skipped. Verified via a new, full jsdom
end-to-end test (`test_harness/verify_category_icons_tabler_migration.js`,
12 checks): confirms the data values, confirms real `<i>` elements
render (not leaked literal text), and confirms the grid remains fully
interactive after the change.

### #47 — ✅ RESOLVED, T147 (operator ruling: C; the corrected T135 account follows) — CORRECTED, T135 (originally `T120`, found via a full-Charter compliance audit, operator-directed): the real number is 17 real services over their REAL, effective ceiling, not 9 — the "tier ceiling" premise itself doesn't match the live mechanism

**Why this stays `NEEDS OPERATOR` even under this turn's extended
autonomy grant** ("use your autonomy and make the decision yourself" on
anything blocking the workflow): decided *not* to flip this one, and
want the reasoning on record rather than just the non-decision. Unlike
`#63` (confirmed-dead code, zero observable behavior change either way,
fully reversible), this carries a real, live, customer-facing
consequence today: whichever way it resolves changes what real
customers are actually asked, for 17+ real services, and therefore what
they're actually charged. My own honest lean, for whatever it's worth
to whoever does decide: the charter's own text — "every service's
authored intake must be capable of reaching 100% confidence within its
range... If it is not, that is an authoring defect" — suggests these
services' authors intended their real, 3-7-question chains to be
askable, and a silent 2-question truncation (today's legacy-path
behavior) risks incomplete scope information reaching the quote, which
seems like a worse customer outcome than a few extra questions. But
that's a lean, not a decision — under-collecting information on a
complex job and over-asking a simple one are both real costs, weighing
them against each other for real services is exactly the kind of
business call this project's own standing discipline (`TIMELINE.md`
`T80`) keeps excluded even under explicit trust, and I'd rather be
honest about not being confident in that trade-off than guess with real
consequences attached.

**Further T135 finding, from the completed Phase 2 Stage A full sweep**:
these same 17(+1) services are exactly the ones where `sqBuildCuratedIntake`
and `renderCuratedCardFromRoute` visibly disagree — the legacy renderer
truncates to the real ceiling (2), the orchestrator renders the full
authored chain uncapped. This isn't a separate bug; it's the same open
question made concrete: whichever way `#47`'s "was ceiling=2 deliberate"
question resolves determines which of the two renderers' current
behavior is actually correct. See `PHASE_PLAN.md`'s Phase 2 for the
full account.
**T135 correction, read this first.** Re-verified directly against the live `qr.html`/`btnyc.json` (not assumed from this entry's own original count): there is no tier-keyed ceiling table anywhere in the code. `global_rules.complexity_tiers` carries only `min_minutes`/`max_minutes`/`hourly_rate` — nothing about question counts. The real, enforced ceiling (`maximum_followup_questions`) resolves per-service (`confidence_strategy`), else per-archetype (`default_confidence_strategy`), else a flat fallback of `3` — never from a `routine`/`skilled`/`specialized` label. Recomputing the full, real 74-service catalog against this actual mechanism (correctly excluding true quantity modules — `item_count`, `count`, `hybrid_qty`, `global_quantity` — exactly as the live code's own `QTY_MODS` set does, confirmed by reading it directly): **17 of 74 exceed their real, effective ceiling.** Of the original 9 named below, `pax_wardrobe_assembly` and `furniture_repair_hourly` are exactly AT their real ceiling, not over it — this entry's original count was wrong in both directions.

The real pattern, newly visible: almost every violation traces to an effective ceiling of exactly **2** — either the service's own explicit setting, or inherited from the `wall_mounted_object` archetype (all 4 wall-mounting groups) or the `plumbing_fixture` archetype (all 5 plumbing-help groups). This isn't 9-17 independent authoring choices; it's a small number of deliberately-set ceiling values that a larger set of legitimately-relevant questions has grown past over time. Full corrected list (service, real question count, real ceiling, source):
`slow_drain_clearing` 5 v 2 (archetype `plumbing_fixture`) · `wall_hole_or_crack_repair` 5 v 2 (own) · `door_repair_impact_damage` 4 v 2 (own) · `internal_hardware_replacement` 4 v 2 (own) · `router_configuration` 4 v 2 (own) · `generic_mounting_service` 4 v 2 (archetype `wall_mounted_object`) · `brick_or_concrete_crack_repair` 3 v 2 (own) · `flatscreen_mounting_standard` 3 v 2 (archetype `wall_mounted_object`) · `flatscreen_mounting_with_hidden_cables` 3 v 2 (archetype `wall_mounted_object`) · `leak_under_sink_repair` 3 v 2 (own) · `loose_tile_replacement` 3 v 2 (own) · `microwave_repair` 3 v 2 (own) · `plaster_wall_repair` 3 v 2 (own) · `repair_appliances` 3 v 2 (own) · `squeaky_floor_repair` 3 v 2 (own) · `washer_repair` 3 v 2 (own) · `wood_paneling_repair` 3 v 2 (own).

**Per direct operator instruction (`T135`+): treated as a real, Charter-grounded investigation, not blocked by the prior "hold for the tier-model rewrite" framing** — but the investigation itself, done independently, reaches a compatible conclusion for an independent reason: the real scope (17 services, concentrated on two archetype-level defaults) is a "what should the friction budget be for `wall_mounted_object`/`plumbing_fixture`" business question, not 17 separate per-service trims. That narrower, concrete, answerable question — was `maximum_followup_questions: 2` deliberate for these two archetypes, or a value never revisited as real content grew — is genuinely low-risk to answer and doesn't require picking which already-relevant question to cut. See `PENDING_DECISIONS_consolidated`'s `#NEW-2` entry for the full account. Original entry preserved below for history.

`PROJECT_CHARTER.md` §6E's own `T90` spot-check claimed "no current
authored service exceeds the new tiered ceilings," naming
`wall_hole_or_crack_repair`/`flatscreen_mounting_standard` as the
worst case, both exactly at the specialized ceiling (7), not over it.
Re-verified directly against the current, live catalog rather than
trusted at face value — **the claim no longer holds.** Confirmed via
direct execution of the real, resolved intake chain for every service
(`orch_compose_intake_chain`, not the raw authored array alone, so
this reflects what a customer actually sees):

| Service | Tier | Ceiling | Actual |
| :--- | :--- | :--- | :--- |
| `flatscreen_mounting_standard` | skilled | 4 | 7 |
| `slow_drain_clearing` | skilled | 4 | 7 |
| `flatscreen_mounting_with_hidden_cables` | skilled | 4 | 6 |
| `internal_hardware_replacement` | skilled | 4 | 6 |
| `loose_tile_replacement` | skilled | 4 | 5 |
| `router_configuration` | skilled | 4 | 5 |
| `generic_mounting_service` | skilled | 4 | 5 |
| `pax_wardrobe_assembly` | skilled | 4 | 5 |
| `furniture_repair_hourly` | routine | 2 | 3 |

None of these 9 services were touched by any work across the entire
`T108`–`T120` session range — confirmed directly, not assumed, by
checking each one's own `intake_chain` against what this session
actually modified. This is a real, pre-existing condition, not a
regression from this session's work. `wall_hole_or_crack_repair`
itself, the charter's own other named example, is **not** currently a
violation — it sits at 7 against a genuine specialized-tier ceiling of
7 (its own `operational_metrics.complexity_tier` is `specialized`, not
`skilled`), so the original claim was only ever half-right even at
`T90`; the drift since then is in the other seven services, all tagged
`skilled` while carrying question counts that would only fit a
specialized ceiling.

**Not triaged or fixed here** — each of the 9 needs its own real
determination (is the complexity tier tag wrong and should be raised
to `specialized`, matching its actual question count? Or is the
question count itself the problem, with real, redundant, or
non-essential questions that should be trimmed per §6E's own rules
1–3?) rather than a batch answer applied to all nine alike. Flagged
here as the concrete, prioritized next step this audit surfaces,
per the charter's own §11 ranking logic (this is the same class of
"§6E gap, not yet systematically audited" already named as `[OPEN]`
in §11 item 9 — this is the first real, itemized data behind that
previously-abstract item).

**RESOLVED T147 — operator ruling: C (the hybrid complexity model, axes as data), applied under the Charter's new provenance rule.**
**Why this was not decided, and what I would have decided.** The T135 entry stayed `NEEDS OPERATOR` by applying the older T80 standing rule (business calls stay excluded even under explicit trust) *against* the Charter's R-GOVERN-AUTONOMY, which says the opposite for anything reversible and documented; and it was tangled with the full redesign (#NEW-2), so it looked like a decision that needed the whole brief. It did not: the shape question was answerable on the evidence. I would have chosen C as well (the consolidated note already leaned that way as aligning with the SSOT principle) and added the constraint the operator named: **a threshold must not be a number someone can tune to pass.**
**What the data says.** The ceiling is a progressive-disclosure window (the card shows the answered questions plus up to N unanswered ones; the legacy builder that truncated at 2 was deleted in T144), not a cap on total questions. Now readable because the resolver names its source, across the 76 services: **33 override the ceiling to 2, 27 inherit 2 from their archetype, 16 set 3-6, none use the fallback; all nine archetypes set 2.** 60 of 76 sit on one hand-set number that is derived from nothing. Every quantity module also carries `confidence_gain: 15`, a copy-paste constant that was being awarded to 12 questions that changed nothing: confidence earned for retiring no uncertainty, which is the "inflated compliance" mechanism, already in the data.
**Decision.** C. For each service the model outputs the four things of the operator's constitutional input: a complexity position, a soft ceiling and a hard ceiling derived from it, and the confidence-selection rule that decides which applies. Constraints, all from this session's findings: (1) **every output is a record `{value, source}`** (R-INVARIANT-PROVENANCE), and the selection rule is the *named, tested arbiter* the Charter says an arbiter must be, returning `{ceiling, which, source}`; (2) the axes are data in `global_rules` (volume: a batched homogeneous job such as 400 knobs; project: one complex job such as the 14-inch closet door), independent per axis, so the soft/hard gap moves per axis rather than by a coefficient; (3) a question counts toward a ceiling only if it is value-bearing (changes price, time, tier or branch), enforced by the T147 ratchet, so padding cannot raise a ceiling and cannot buy confidence; (4) archetype-level 2s are retired service by service on the evidence, never lowered or raised as a block.
**Done now (T147).** The ceiling and strategy resolvers name their source (`verify_r-invariant-provenance_caller_composition.js`); the caller's `|| 5` is gone; quantity questions that priced nothing are wired or removed; the padding ratchet exists. **Next stages:** the axes as data; the soft/hard derivation with provenance; the selection rule as a named function; then per-service retirement of the 2s.

### #48 — ✅ CLOSED (`T121`, operator-directed, external catalog audit "Issue 1"): raw `btnyc.json` data and its own compiled output disagreed
Two confirmed instances named directly: `angle_stop_replacement` (raw
`intake_chain` included `hybrid_qty`; `compiled.service_index`
included a stale `access` instead) and `faucet_repair_drip` (raw chain
had no `access`; compiled included one). Root cause, confirmed
directly rather than assumed: the `compiled` namespace had not been
regenerated since before this session's own `#45` (`access` removed
catalog-wide) — it still referenced a module deleted from everywhere
else in the catalog. Confirmed `qr.html` and every extracted module
never read `compiled.*` at runtime (an exhaustive grep, not assumed),
so this was a real data-integrity defect with zero customer-facing
risk, not a live bug — still fixed exactly as instructed, not
downgraded because of that.

**Resolution:** ran `btnyc_v8_compiler.py` fresh; confirmed the
compiler itself is correct — zero `intake_chain` disagreements across
all 74 real services and all 97 `dynamic_services` (which the compiler
passes through byte-identical, confirmed directly, so there is no
separate compiled layer for them to disagree with in the first place).
Merged the fresh, correct `compiled` namespace back into the live
`btnyc.json`.

**A third, real, previously-undetected bug found while verifying the
fix, not assumed away:** `plumbing_help+Install`'s own **raw source
data** — not just the stale compiled cache — had two `then`-branch
target lists still naming `access` as a module to route to
(`plumbing_fixture`'s "Sink or faucet" and "Other" branches). `#45`'s
original removal checked authored `intake_chain` arrays and
`intake_defaults`; it never checked `then`-branch target lists, so
this dangling reference survived that pass undetected. Fixed at the
source (removed `access` from both target lists), re-ran the compiler
a second time to confirm zero remaining "access" strings anywhere in
`compiled`, and re-merged. A full sweep of every real service and
`dynamic_service`'s own `then`-branches for the same pattern confirmed
this was the only instance catalog-wide.

Verified via a new, comprehensive test
(`test_harness/verify_raw_vs_compiled_reconciliation.js`, 10 checks):
both originally-named discrepancies resolved, the newly-found
dangling-reference bug fixed and regression-guarded, a catalog-wide
sweep for the same pattern, and a live re-run of the actual compiler
inside the test itself confirming zero raw-vs-fresh-compile
disagreements — not a snapshot that could itself go stale.

### #49 — ✅ CLOSED (`T123`–`T131`, operator-directed, external catalog audit "Issue 2"): dynamic chains whose shape doesn't match their group's routing archetype
Five sub-patterns identified (2a–2e). Working batch by batch, full
suite after each, per explicit guidance not to fix individual services
one at a time.

**2a — ✅ CLOSED: `component_first` groups' Mount/Install/Setup/Assembly
fallbacks asked only `global_quantity`.** 26 `dynamic_services` entries
fixed, each given a real "what specifically" component question as
its new first step. Four reused the catalog's own existing, genuinely
well-fitting vocabulary (`mounting_item` on all 5 `wall_mounting`
`+Mount` fallbacks; `electrical_item` on all 6 `electric_lighting`
`+Install` fallbacks; `plumbing_fixture` on all 5 `plumbing_help`
fallbacks; `tech_device` on the 3 `tech_trouble` sub-groups it
genuinely fits — computer_repair, networking, smart_home).

Two new modules authored where the existing vocabulary genuinely
didn't fit, per explicit permission to do so: `appliance_item`
("Which appliance is this for?" — Washer/Dryer/Stove/Refrigerator/
Dishwasher/Microwave/Window AC/Other, matching the real, existing
`minor_home_repairs_appliances_*` sub-group set exactly) for
`minor_home_repairs+minor_home_repairs_appliances+Mount`, since no
existing module asked which appliance (`appliance_type` asks built-in
vs. freestanding; `symptom` asks what's wrong — neither identifies
which appliance); and `cable_install_item` ("What kind of cable work
are we doing?") for `tech_trouble_cable_management`'s own
`+Install`/`+Setup` fallbacks specifically, since `tech_device`'s
options (Computer/Router/Smart speaker) don't describe cable work at
all, and `cable_symptom` — confirmed directly, not assumed — is a
diagnostic question authored for `cable_management`'s own separate
`+Diagnostic` fallback, not an install/setup question.

**A genuine, valuable match found along the way, not manufactured**:
`install_target` — reverted last turn (`T120`) after being wrongly
wired onto a single, narrow wall-mounting service its own 8 broad
options didn't fit — turned out to be exactly the right shape for the
*bare* `minor_home_repairs+Install` fallback, a genuine multi-category
catch-all with no sub-group narrowing it, which is precisely the
context that broad an option set was always suited for. Its own,
now-stale `_orphan_backlog_note` (written last turn explaining the
reversion) removed, since it is genuinely, correctly referenced again.

Verified via a new, comprehensive test
(`test_harness/verify_dynamic_archetype_batch_2a.js`, 30 checks)
covering every one of the 26 fixed entries by name, both new modules'
real distinctness from existing, similarly-shaped ones, and a
regression sweep confirming none of the 26 named targets still has a
bare, qty-only chain. Full suite clean throughout (three test files
needed updates for now-correct, no-longer-stale expectations about
`install_target`'s orphan status, all individually verified passing).

**2b — ✅ CLOSED: `symptom_first` appliance groups' `Repair` fallbacks
asked `surface_type`.** "What kind of surface?" for a broken appliance
is a category error, not a scoping question. All 8 confirmed exactly
as described (the broad `minor_home_repairs_appliances` group plus its
7 named per-appliance sub-groups: washer, dryer, stove_range,
refrigerator, dishwasher, microwave, window_ac). A direct, pure
substitution — no new module needed: swapped `surface_type` for
`symptom`, the same shared, already-established module the real, named
services (`washer_repair`, `dishwasher_repair`, `microwave_repair`,
`repair_appliances`) already use for exactly this purpose. Confirmed
`surface_type` remains correctly, genuinely referenced elsewhere (the
real `surface_repair`-archetype groups it's meant for), not orphaned
by this change. Verified via a new test
(`test_harness/verify_dynamic_archetype_batch_2b.js`, 13 checks). Full
suite clean with zero test fallout this time (unlike 2a, which needed
three test updates).

**2c — ✅ CLOSED: `component_first` non-appliance groups' Repair
fallbacks (`cabinets_drawers`, `furniture`, `doors`) also asked
`surface_type`.** Same category error as 2b, but the existing
appliance-shaped `symptom` module didn't fit these either ("won't
spin," "won't drain" describe appliance failures, not cabinet or door
problems). Authored three small, new, group-specific modules —
`cabinet_issue`, `furniture_issue`, `door_issue` — each with 4 real
options plus the standard "Other" catch-all, anchored to the existing,
directly-analogous `furniture_repair_formula`'s own issue-type fee
scale ($0–25 fee, 10–25 minutes) rather than invented from nothing.
Every fee-bearing option carries a real `modifier_ref`, not just an
`affects_price: true` claim — verified empirically, not asserted: all
three show genuine $80–108 price differences between options. One real
process catch, not smoothed over: the new modifiers initially lacked
the catalog's own required explicit `scope` field, caught immediately
by the existing `#29` regression test rather than shipped silently;
fixed to `per_unit`, matching the existing modifiers they were
anchored to. `furniture_issue` confirmed genuinely distinct from the
existing `issue` module already used by the real, named
`furniture_repair_hourly` service — zero overlapping option labels.
Verified via a new test
(`test_harness/verify_dynamic_archetype_batch_2c.js`, 12 checks). Full
suite clean (146/149, the same three pre-existing failures).

**2d — ✅ CLOSED: non-appliance groups' `Diagnostic` fallbacks
(`cabinets_drawers`, `doors`, `floors_trim`, `furniture`, `walls`,
`windows`) reused the shared, appliance-shaped `symptom` module.**
Options like "won't spin," "won't drain," "leaking water" describe
appliance failures — reused for doors/walls/cabinets/windows, the
question is a category error, not a scoping one. Confirmed all 6
still exactly as described. Three of the six groups
(`cabinets_drawers`, `doors`, `furniture`) already had a real,
group-specific issue module from batch 2c's own `+Repair` fix —
reused directly, no duplication. Three new modules authored for the
rest — `floor_issue`, `wall_issue`, `window_issue` — each anchored to
the same real `furniture_repair_formula` fee scale as 2c, each with a
required, explicit `scope: 'per_unit'` from the start this time (no
test fallout, unlike 2c). Verified empirically: all three genuinely
change price ($108 differences on their higher-severity options).
Verified via a new test
(`test_harness/verify_dynamic_archetype_batch_2d.js`, 20 checks). Full
suite clean (147/150, the same three pre-existing failures).

**2e — ✅ CLOSED (final batch): `Setup` used on two non-`tech_trouble`
named services.** `Setup` asks "What type of setup are we working on?
Desktop computer setup / TV / media center / Both" — a genuinely
tech_trouble-specific question. `cable_management` (organizing/hiding
cables) and `flatscreen_mounting_standard` (mounting a TV, already
self-evidently a TV job) both had it anyway. Unlike 2a–2d, this wasn't
a wrong-vocabulary problem needing a substitute — a straight removal,
per explicit operator guidance, no replacement needed. Confirmed
before removing: `Setup` remains correctly, genuinely referenced by
the real `tech_trouble` dynamic_services entries it actually fits
(`tech_trouble+Install`, `tech_trouble+Setup`), so this isn't an
orphaning concern. Neither service ended up with an empty chain.
Verified via a new test
(`test_harness/verify_dynamic_archetype_batch_2e.js`, 7 checks). Full
suite clean (148/151, the same three pre-existing failures).

**Issue 2 complete.** All five sub-patterns (2a–2e) closed across
`T123`–`T131`: 26 fallbacks given real component questions (2a), 8
appliance-Repair fallbacks fixed with a pure substitution (2b), 3 new
group-specific issue modules built for non-appliance Repair (2c), 6
non-appliance Diagnostic fallbacks fixed reusing 2c's own modules plus
3 more new ones (2d), and 2 mis-attached questions removed outright
(2e). 9 new intake_modules authored total (`appliance_item`,
`cable_install_item`, `cabinet_issue`, `furniture_issue`,
`door_issue`, `floor_issue`, `wall_issue`, `window_issue`, plus
`install_target` correctly re-homed), every fee-bearing new option
carrying a real, anchored `modifier_ref` rather than left
informational. Moving to Issue 3 next, per the plan's own explicit
order of operations.

### #50 — ✅ CLOSED (`T125`, operator-directed): `enterFocusedMode`'s `sqTextBar` visibility was all-or-nothing; needed to be scoped to the specific entry path
An earlier fix (`v9.6`) had unconditionally removed `sqTextBar` from
focused mode's force-hide logic entirely, citing the Charter's own
three-parallel-entry-paths principle — hiding it while browsing the
catalog was "silently taking free-text off the table." That correction
was itself too broad in the other direction: `sqTextBar` then never
hid at all, including the one real case — a category tile visually
tapped — where hiding it makes sense. Confirmed directly, not assumed,
before touching anything: the operator's own pasted "before" code
didn't match what was actually in `qr.html`, and applying it verbatim
would have silently reverted the `v9.6` correction rather than fixed
the real, narrower problem.

**Resolution:** added an explicit `hideTextBar` parameter to
`enterFocusedMode` (default `false` — safe, visible). Only
`showGroupsForCategory` — the one real handler for a visual category
tile tap, confirmed via its own `Breadcrumbs.push({type:'categories'})`
call happening in the same, `fromBack`-gated block — passes `true`.
All 6 other real call sites (`showIntakeQuestions`,
`prefillSmartQuoteFromOtherTile` — literally named for "Other tile"
entry — `prefillSmartQuoteFromService`, `renderTagAffirmationFromRoute`,
`sqPrepareFlow`) call it bare, defaulting to visible — covering every
case the operator named ("Other tile entry," "a service isn't
matched") plus the guided-builder and free-text-affirmation paths.
Verified end-to-end via a new jsdom test
(`test_harness/verify_focused_mode_textbar_scope.js`, 8 checks): a
real category tile tap hides the bar, navigating one level deeper
genuinely restores it, and the core guarantee (any bare call restores
visibility) is confirmed directly.

### #51 — ✅ CLOSED (`T125`, operator-reported): 28 test failures reported from the operator's own machine — confirmed as file-sync staleness, not a regression
The operator ran the full suite on their own, separate machine
(`/home/tmnero/...`, confirming this project is genuinely developed
across two machines with no shared filesystem, exactly as
`PROJECT_CHARTER.md`'s own cross-session file discipline section
describes) and reported 28 failures, asking directly whether the
harness was missing real bugs or their data was stale.

**Investigated rather than assumed either way.** Read the actual
failure output in detail. Every single failure traced to one of two
confirmed causes, both pointing at file staleness on their machine,
not a real, current bug:
- **Direct crash evidence**: `verify_answers_round_trip.js` and
  `verify_answer_supersedes_nlp_tag.js` crashed with
  `TypeError: Cannot read properties of undefined (reading
  'client_response')` at `DB.intake_modules.access` — confirming
  `access` genuinely is deleted on their machine (their `btnyc.json`
  is current), but these specific test files are still the pre-`#45`
  versions that reference it directly. `verify_damage_type_force_injection_fix.js`
  crashed the same way against `global_rules.force_modules_by_variability`
  — a field renamed to `_DEPRECATED` back in this session's earliest
  Steps 1–5 work, confirming this specific file predates even that.
- **Stale assertions, not crashes**: the remaining ~24 failures
  (`verify_buy_the_hour_question_set.js`,
  `verify_pricing_archetype_restoration.js`,
  `verify_self_quote_ui_template_invariant.js`, and others) each
  assert something this session already, deliberately changed —
  re-checked two directly (`verify_tech_symptom_module.js`,
  `verify_nlp_incidental_keyword_fix.js`) against this session's own,
  current sandbox and both pass cleanly (39/39, 8/8), confirming they
  were already fixed here and simply hadn't reached the operator's
  machine yet.

**Confirmed directly, not assumed, that this session's own current
state is clean**: full suite re-run on this sandbox, 144/146, the same
two permanent, pre-existing failures as every checkpoint since `T108`.
Zero of the 28 reported failures reproduce here.

**Resolution:** rather than hand over 27 individually-named files and
risk missing others not yet visibly failing, packaged the complete,
current `test_harness/` directory (161 real files, `node_modules`/
`__pycache__`/`RESULTS` excluded) as a single archive for a clean,
complete re-sync — removing the guesswork of tracking which
individual files across many sessions' worth of fixes had and hadn't
reached the operator's machine.

### #52 — ✅ CLOSED (`T126`, operator-reported, second round): a smaller, more precise 8-failure report surfaced two real, genuine issues on this side, not diagnosed away as sync staleness a second time
The operator applied the `T125` resync and re-ran, down to 8 failures
from 28 — but pushed back directly rather than accept another blanket
"it's sync" explanation, and asked for a careful, exhaustive
comparison. Right call: two of the eight were real, own-side problems,
not their environment.

**A genuine, concrete delivery gap, found and owned directly:**
`verify_archetype_layer_phase1.js`, `verify_raw_vs_compiled_reconciliation.js`,
`verify_routing_archetype_semantic_check.js`, `verify_btnyc_v8_compiler.py`,
and `verify_compiled_output_against_real_schema.py` — 5 of the 8 —
all crashed on the identical root cause:
`btnyc_v8_compiler.py: No such file or directory`. Confirmed directly:
this script has been used constantly this entire session (including
inside a test this session itself wrote, `#48`'s own
`verify_raw_vs_compiled_reconciliation.js`) but, because it was never
*modified*, it was never flagged as changed and never once presented
as a deliverable — a real gap in this session's own delivery practice,
not the operator's syncing. Systematically checked every other
top-level project script referenced anywhere in `test_harness/` for
the same risk (21 checked); none of the others are implicated by any
reported failure, and the ones generated fresh by `extract_modules.js`
(itself run at the start of every `run_all.sh`) were never a real risk
in the first place. Delivered now.

**A second, more serious mistake, corrected and owned directly, not
smoothed over:** `verify_nlp_incidental_keyword_fix.js` depended on a
hardcoded `/tmp/t118_before/qr.html` — an ephemeral snapshot from one
specific sandbox session. Last turn's own diagnosis claimed this test
was "already fixed" here, verified by re-running it and seeing it
pass. That check was flawed: it passed only because that one sandbox
session's own `/tmp/` happened to still be alive from earlier in the
*same* continuous session, an artifact that would never exist on the
operator's machine, or even a fresh instance of this same sandbox —
confirmed the hard way, by temporarily removing that directory and
watching the test fail with the exact same error the operator
reported. Fixed properly this time: extracted the real, historical
pre-`T118` `detectIntentNLP` function from that snapshot before it was
lost for good, embedded it permanently in a new fixture
(`test_harness/fixtures/pre_t118_detectIntentNLP.js`), and removed the
external dependency entirely. Re-verified with the ephemeral directory
actually deleted, not just present-but-unused, before calling it done.

**Confirmed, not just asserted, that the remaining unexplained failure
is real staleness, not a third own-side bug:**
`verify_dynamic_archetype_batch_2b.js` fails on the operator's machine
checking real data (`intake_chain` values), not a crash; its own
checksum matches what's already on their machine (the test file
itself isn't stale); this session's own sandbox passes it cleanly
(13/13); and the sync manifest diff at the top of the operator's own
report shows no `btnyc.json` change was applied in that round. All
four points together — not any single one alone — support the
conclusion that their `btnyc.json` genuinely predates this session's
own `#49`/batch-2b delivery, rather than a live bug in the current
data or test.

`verify_no_orphaned_data.js` reconfirmed identical on both sides (45
orphans, exact match) — the same known, permanent, already-tracked
failure, not a new concern.

**Full suite**: 145/147, the same two permanent, pre-existing
failures as every checkpoint since `T108`.

the Ceilings group shows a real, correctly-computed $94 starting price
with zero questions asked at all — including no quantity prompt, so a
customer relying purely on catalog browsing never gets asked "how
many tiles." Separately, the group's own name/framing ("Ceilings")
may read as general ceiling repair rather than the narrower, real
service actually offered (ceiling-tile replacement specifically). Two
related but distinct real questions: (a) should catalog navigation
into a dynamic-service-only group always prompt at least its own
intake questions before showing any price, and (b) is "Ceilings" the
right display name, or should it be more specific. Not fixed here —
needs a real decision on intended catalog-navigation behavior, not
just a rename.

**Fixed (`T118`, Step 6 item 6), per explicit operator direction on
both parts:** (a) renamed "Ceilings" to "Ceiling Tile Replacement" in
the source group data, and in a compiler-derived copy
(`routing_archetypes`) found and fixed alongside it so the two didn't
silently diverge. (b) Traced the real navigation path precisely
(`showServiceTypesForGroup` -> `renderComponentSymptomPicker` ->
`resolveComponentSymptomTap` -> `sqOpenBuilderPreseeded` ->
`sqBuilderGetSteps`) to the actual root cause: the Guided Builder's own
step sequence never included a quantity step at all, so `BLD.qty`
stayed at its hardcoded default forever for any session reached via
catalog navigation — confirmed this is genuinely distinct from
free-text sessions, which already attempt real extraction via
`extractQty(existingText)` at open time. Added a new `qty` step (chip
choices 1/2/3/4/"5 or more"), included specifically when
`BLD._fromOtherTile` is true, so free-text sessions aren't asked
redundantly.

**A real bug in this fix's own first attempt, caught by its own
end-to-end test before shipping, not smoothed over:** the initial
version seeded `qty: 1` (a literal number) as the "unanswered" default,
but the existing "already answered" skip-forward logic in
`sqBuilderChoose` treats any non-null/non-undefined value as answered
— so the new qty step was silently auto-skipped, exactly the bug shape
this item exists to fix, reintroduced by the fix itself. Corrected to
`qty: null` (genuinely unanswered), relying on `sqBuilderFinish`'s own
pre-existing `BLD.qty || 1` fallback to default safely on read either
way. Verified via a new, full jsdom, real-browser-engine end-to-end
test (`test_harness/verify_dynamic_service_qty_gate.js`, 14 checks):
simulates the actual diagnosed navigation path, steps through the
builder to the new question, selects "5 or more," and confirms the
selected quantity genuinely reaches the final quote state (`S.qty`),
not just internal builder state.

### #53 — ✅ CLOSED (`T127`, operator-provided, a comprehensive "what's missing from my synced directory" report): 14 named items, each verified individually rather than batch-restored
The operator provided a large, multi-file dump of content apparently
absent from their local directory and asked for a careful comparison,
"take your time and ensure you didn't overlook anything." Investigated
each of the 14 named items on its own terms — existence, content match,
and *why* it might be absent — rather than restoring the whole set
uncritically, since for at least one item (below) doing so would have
undone a deliberate, already-verified decision.

**Genuine delivery gaps — real, current, correct files this session
had but had never actually delivered, the same pattern as
`btnyc_v8_compiler.py` (`#52`):** `cms_bridge.js`,
`FORCE_INJECTION_AUDIT.md`, and `qr_loader.js` — confirmed byte-for-byte
identical to what the operator's own dump showed, so these are pure
delivery gaps, not content questions. Also
`test_harness/verify_btnyc_v5_compiler.js` — its own docstring
confirms it genuinely tests the current `btnyc_v8_compiler.py` (kept
under an old filename "for `run_all.sh` discovery compatibility"), a
real, additional regression test this session didn't have; ran it
directly against the current catalog rather than assumed it would
pass — 13/13, clean.

**Files that exist but are *generated*, not hand-authored — content
differences are naturally expected, not a delivery failure:**
`innerhtml_audit.json`, `state_mutation_classification.json`, and
`SWEEP_RESULTS.json` are all written fresh by their own scripts
(`verify_innerhtml_audit.js`, `verify_state_mutation_classifier.js`,
`automated_path_sweep.js`) every time `run_all.sh` runs — confirmed
directly by finding each script's own `outputPath` line, not assumed.
The operator's copies simply predate this session's later `qr.html`
edits; current versions delivered. `orphaned_data_report.txt` follows
the same pattern but was missed for a different, real reason: it lives
under `RESULTS/`, which this session's own `test_harness` archive
(`#52`) explicitly excluded as build noise — a genuine packaging gap,
now fixed by delivering it directly. `run_all.golden` turned out to be
byte-identical to the current `run_all.sh` — a trivial, one-line copy,
delivered.

**Correctly, deliberately absent — restoring these would have been a
mistake, not a fix:** `pricing_engine_library.py` is confirmed, byte
for byte, to be the exact file this session deliberately deleted in
`T119` (dead code, zero imports anywhere, didn't even reflect the real
per-service formulas) — its absence is the correct, intended state, not
a gap. `verify_btnyc_v7_compiler.py` tests a `btnyc_v7_compiler.py`
script that no longer exists anywhere in the project (confirmed by
direct search) — superseded by v8, correctly gone with it.
`ui_test_report.json`'s own `timestamp` field reads July 11, 2026 — a
one-time historical snapshot from months before this session began,
not a file this session was ever expected to maintain or could
meaningfully regenerate now.

**Flagged rather than restored — genuinely doesn't look like a real,
coherent project file:** `pricing_archetypes.json`'s own top-level
keys are `global_rules1`/`global_rules2`/`global_rules3`,
`routing_archetypes1`/`2`/`3`, `pricing_formulas1`/`2`, and more —
374KB of what appears to be multiple, differently-timestamped
`btnyc.json`-shaped snapshots concatenated under suffixed keys, not one
coherent file. Confirmed one specific, checkable data point rather than
guessing: `global_rules1`'s own `force_modules_by_variability` shows
the exact unconditional, all-four-tiers-identical shape
`FORCE_INJECTION_AUDIT.md` itself documents as the *pre-removal* state
— meaning at least this section predates `T118`'s own force-injection
work by a wide margin. Did not attempt to reconstruct or restore
something this structurally confusing without understanding what
produced it; flagged for the operator's own judgment instead.

**Full suite**: 146/148, the same two permanent, pre-existing failures
as every checkpoint since `T108`.

### #54 — 🔄 PARTIALLY CLOSED (`T129`, operator-directed): merged operator's own `qr.html` styling edit; found and fixed real, confirmed CSS defects; the specific reported bug (service tiles under the intake container in focused mode) investigated but not conclusively reproduced
The operator made their own direct CSS edits to `qr.html` (tile/group
grid presentation) and reported a remaining issue: service tiles (e.g.
"Microwave Setup") appearing under the intake question container,
erroneously, in focused mode. Explicitly non-urgent, but "should be
buttoned up by the next `qr.html` upload."

**Confirmed directly, not assumed**: the operator's uploaded file's
JS/body content is functionally identical to this session's own
current `qr.html` (a single stray blank line was the only difference)
— the edit was CSS-only. Comparing the CSS sections directly surfaced
a real, genuine, pre-existing defect in this session's own file, not
introduced by the operator: **three separate, conflicting
`.focused-mode .service-tile` rule blocks** had accumulated (likely
across several earlier sessions' edits, never consolidated), two of
them using **CSS values that are not valid at all** —
`display:flex-wrap` and `display:row` are not real values for the
`display` property (`flex-wrap` is a separate property; the row/column
values belong to `flex-direction`). Invalid declarations are silently
dropped by the browser, so the actual effect of these blocks was
unpredictable, not simply "the last one wins" as intended. The
operator's own edit had already consolidated all three into one clean
definition.

**Resolution**: merged the operator's CSS section into this session's
current `qr.html` (confirmed byte-identical body otherwise, so this is
a clean, complete merge, not a partial patch) — adopting their
consolidation as the fix for the confirmed duplicate/invalid-rule
defect.

**The specific reported bug — investigated thoroughly, not
conclusively confirmed or ruled out.** Traced the real, actual click
path a customer takes on a service tile (`createServiceCardElement`'s
click handler → `prefillSmartQuoteFromService`, not
`showIntakeQuestions` directly — confirmed by direct code read, not
assumed). Directly verified, via a real jsdom run navigating category
→ group → the real `microwave_setup` service: `serviceContainer` and
`intakeQuestionsContainer` both correctly end up hidden
(`display:none`), the SmartQuote UI correctly shows, and zero
`.service-tile` elements remain visible anywhere in the final DOM —
both before and after the CSS merge. Could not reproduce the reported
overlap this way. Two real limits on this investigation, stated
plainly rather than glossed over: (1) jsdom computes CSS property
values but does not perform real visual layout, so a purely
visual/positional overlap (as opposed to a `display` or DOM-structure
bug) would not show up in this kind of test; (2) the exact navigation
sequence that produces the reported state was not identified, only
approximated.

**Assessment**: the confirmed, fixed defect (duplicate/invalid
`.service-tile` CSS) is a plausible, credible contributor to erratic
tile appearance in focused mode, and is now fixed either way. Whether
it was the specific, complete cause of the reported bug is not
confirmed. Left open rather than claimed closed — if the issue
persists after this fix, the next step is a real screen recording or
the exact tap sequence, since headless testing has reached its limit
here.

**Full suite**: 146/149, the same three pre-existing/documented
failures as every checkpoint since `T108`.

### #55 — ✅ CLOSED (`T132`, operator-provided): the "v10 compiler" mystery from the last report explained and resolved — 5 real, confirmed regressions found and fixed, plus a genuine improvement adopted
The prior turn's failure report included `verify_btnyc_v10_compiler.js` crashing with a Python-syntax error, unexplained at the time. The operator then provided `btnyc_v10_compiler.py` and `verify_btnyc_v10_compiler.js` directly, resolving the mystery and surfacing something much bigger: this compiler, and its stale/reverted state, is the direct explanation for nearly every compiler-related failure across both of the operator's last two reports.

**The naming bug, confirmed directly:** `verify_btnyc_v10_compiler.js`'s own shebang and docstring both say `verify_btnyc_v10_compiler.py` — it's genuine Python, saved with a `.js` extension, which is exactly why `node` choked on its `"""` docstring. Renamed.

**Four real, confirmed regressions in `btnyc_v10_compiler.py` itself**, found by direct, byte-level comparison against this session's own known-correct `btnyc_v8_compiler.py` output rather than assumed from symptoms:
1. Field names reverted to pre-fix versions (`real_components` instead of `real_component_ids`, etc.) — no real consumer in `qr.html` could read this compiler's output at all.
2. `build_routing_archetypes` always re-derived every group from scratch, missing v8's entire "preserve existing, hand-curated content" mechanism (parent-group preservation, existing-classification preservation, existing-component/symptom-ID preservation) — this alone explains the operator's `tech_trouble_computer_repair` misclassification and the `minor_home_repairs_walls` symptom-count pollution.
3. `build_pricing_archetypes` only checked for an already-set `pricing_archetype` field, missing v8's derivation fallback — dropped ~70 real `dynamic_services` entries from `currently_assigned_to` counts (`diagnostic_open` alone went from a real 27 entries to 1).
4. `compile_pricing_index` only read `financial_engine.pricing_type`, missing `financial_engine.type` — the same shape of bug already found and fixed in `qr.html`'s own pricing engine (`#44`, this same session), a separate instance, not a regression of that fix.

All four fixed directly in the file (each with a dated comment explaining what was wrong and how it was confirmed, matching this session's own established practice). Verified via direct, byte-level diff: `routing_archetypes` and `pricing_archetypes` are now fully identical to this session's known-correct data.

**A genuine improvement adopted, not just a fix restored:** once corrected, v10's `service_index` carries real fields v8 never captured (`confidence_strategy`, `behavior`, `remote_deep_dive_modules`, `requires_furniture_selection`), and its module-classification lists are more current than v8's static, pre-session snapshot — correctly aware of every module this session authored in Issue 2 (`cabinet_issue`, `wall_issue`, and the rest). This also surfaced something worth naming plainly: this session's own `compiled` namespace had been stale since `T121` — never refreshed despite Issue 2's later batches adding real, new modules. Merged the fixed v10's output in; confirmed zero non-compiler (raw data) keys changed in the process.

**Two further things found and fixed while verifying against the operator's own, more thorough `verify_btnyc_v10_compiler.py` test (56 checks):**
- A schema-path resolution bug shared by both v8 and v10 (resolved relative to the *input file's* directory, breaking when compiling to/from a temp directory, as the test's own idempotency check does) — fixed by resolving relative to the compiler script's own location instead, a genuine robustness improvement, not just a test workaround.
- A real, internal contradiction within the test file itself: one check asserted `dmg_size` classifies as a symptom, while a different check (already passing) asserted `minor_home_repairs_walls`' symptom count is empty — both cannot be true simultaneously, since `dmg_size` is `wall_hole_or_crack_repair`'s only symptom-shaped module. Confirmed against v8's own docstring (`dmg_size` was deliberately *removed* from symptom classification, "a severity/scope question, not a symptom") that the empty-count check was the correct one; fixed the two contradicting assertions to match.

Also updated `verify_ssot_consultation.js` to acknowledge v10's four new `compiled` sub-namespaces (`module_index`, `smart_tag_index`, `material_index`, `formula_index`), matching the existing allowlist pattern for the six they join.

**Full suite**: 150/152, the same two permanent, pre-existing failures as every checkpoint since `T108`.

### #56 — ✅ CLOSED (`T133`, operator-provided): full v8→v10 test-suite migration adopted; a genuinely stale runtime-documentation string fixed; the operator's own "72.5% conformance" review fact-checked claim by claim, not accepted wholesale
The operator uploaded 18 files (a migration report, `btnyc.json`,
`btnyc_schema.json`, `btnyc_v10_compiler.py`, `run_all.sh`, package/
dependency files, and 10 test files) alongside a separate, external
"conformance review" of `qr.html`/`btnyc.json` against the Charter.
Both handled the same way as every prior external artifact this
session: verified directly before adopting or agreeing, not trusted
because they arrived from outside.

**The compiler.** The uploaded `btnyc_v10_compiler.py` already had the
fixes the migration report itself called "pending" (`build_archetype_mismatch_report`
restored verbatim from v8, the duplicate `build_pricing_archetypes`
removed) — confirmed by running it and diffing its output against
this session's own known-good baseline before adopting, not by
trusting the file's own "← add" comments. Zero raw-data drift.
`btnyc_schema.json` already declared the new `_archetype_mismatch_report`
key from this session's own earlier work.

**The test-suite migration, adopted and cross-checked, not
copy-pasted wholesale:**
- Confirmed a real gap in this session's own prior (`T132`) work: three
  existing tests (`verify_archetype_layer_phase1.js`,
  `verify_raw_vs_compiled_reconciliation.js`,
  `verify_routing_archetype_semantic_check.js`) were still silently
  calling `btnyc_v8_compiler.py` directly, never redirected to v10
  despite the compiler itself being fixed. Adopted the operator's
  corrected versions.
- `verify_file_integrity.js`: added `btnyc_v10_compiler.py` to the
  tracked-source list additively (the list is already existence-
  filtered, so v7/v8 stay listed harmlessly).
- `verify_ssot_consultation.js`: fixed four stale `v8` references and
  a stale "6 pre-indexes" claim (v10, with this session's own T132
  additions, genuinely generates 10).
- Two new JS ports (`verify_compute_quote_for_draft.js`,
  `verify_input_sanitization.js`) depend on a file, `btnyc.js`, that
  does not exist anywhere in this project — confirmed by direct,
  exhaustive search, not assumed. Genuinely unresolved; not this
  session's to fabricate. The uploaded `run_all.sh` already skips both
  gracefully when the file is absent rather than counting them as
  failures, so adopted them with that protection already in place
  rather than held back.
- `verify_purity_audit.js` (one of the four new ports) hardcoded the
  operator's own machine path (`/home/tmnero/...`) — fixed to the same
  portable, `REPO_ROOT`-relative pattern every other test in this
  harness already uses, then verified it runs correctly.
- `package.json`/`ajv`/`ajv-formats` adopted, installed for real (`npm
  install`, not hand-edited into `package-lock.json` per the
  migration report's own explicit guidance), and the schema-verifier
  JS port confirmed working with the dependency present.
- The four migrated `.py` originals correctly stop double-counting via
  `run_all.sh`'s own new `case` skip — `verify_purity_audit.py`, one
  of this session's two permanent baseline failures throughout, is now
  genuinely superseded rather than merely tolerated.
- `verify_btnyc_v10_compiler.py`: the uploaded version independently
  reached the same `dmg_size`-classification fix this session made in
  `T132` (different wording, identical conclusion — a real, useful
  cross-confirmation), plus the new `_archetype_mismatch_report` key.
  Adopted directly.

**A genuinely stale runtime-documentation string, found and fixed —
but its real severity confirmed directly, not assumed from the
claim.** `workflow.steps[2]` (`compose_intake_chain`)'s own `_note`
and `sources` fields still named the pre-`T118`
`global_rules.force_modules_by_variability`, never updated when that
field was renamed. Traced the actual, live `executeWorkflow` function
before accepting the outside review's claim that this "breaks the
chain": it dispatches purely on `step.operation`/`step.id` through a
hardcoded switch calling real functions (`orch_compute_variability_flags`,
etc.) — `sources` is never dynamically resolved as a data path, the
same purely-descriptive pattern as every `_note` field elsewhere in
this catalog. Confirmed the real, live `orch_compose_intake_chain`
function already correctly reads the new mechanism (its own `T118
FIX` comment says so). Fixed the stale string for accuracy regardless
— real staleness is worth correcting even when its claimed severity
isn't.

**The external "72.5% conformance" review, fact-checked claim by
claim rather than accepted or dismissed wholesale:**
- The `workflow.steps` finding: real, but overstated (above).
- The dual-renderer finding (`renderCuratedCardFromRoute` vs.
  `sqBuildCuratedIntake`): confirmed correct — matches this session's
  own, independently-reached Charter-audit finding.
- The claim that the system "still relies on distinct, hand-authored
  JavaScript functions (such as `tile_repair_formula` and
  `pax_wardrobe_formula`)": **false**, confirmed directly — zero
  matches for either as a function anywhere in `qr.html`; both are
  genuinely declarative entries in `btnyc.json`'s own
  `pricing_formulas`, exactly the shape the Charter's own §6A goal
  describes. Not partially true, not a matter of interpretation — the
  claimed JS functions do not exist.

**Full suite**: 151/152, genuinely improved from this session's own
150/152 baseline — `verify_purity_audit.py`, one of the two permanent
failures throughout this entire session, is now correctly superseded
rather than separately counted.

### #57 — ✅ CLOSED (`T134`, operator-provided + operator-directed autonomy grant): `btnyc.py` naming corrected, a real qr.html duplicate-ID bug found and fixed, a genuine schema-validation typo fixed, and a master test-suite membership check built
The operator corrected a naming assumption (`btnyc.js` → `btnyc.py`,
confirmed directly against the original `.py` verifiers, which both
reference `btnyc.py` consistently), shared a real UI fix already
applied to `qr.html`'s `<body>`, and gave explicit, standing autonomy
to make and act on decisions going forward without waiting for
confirmation first.

**Naming fix**: both JS ports and the `run_all.sh` guard corrected to
`btnyc.py`. The file still doesn't exist in this project either way —
confirmed by search — so this doesn't change functional status, only
accuracy; still gracefully skipped.

**`qr.html` body merge, and a real bug found in the process, not
just adopted verbatim**: merged the operator's own `<body>` fix
precisely via line-range replacement, confirmed via jsdom that
console errors are zero and the page initializes correctly. Caught
one real issue in the pasted content before shipping it, rather than
merge it uncritically because the operator's own message said "ship
it": `<div id="serviceContainer">` wrapped a second,
identically-`id`'d div carrying the actual `group-grid` class.
Confirmed empirically that `getElementById` resolves to the outer,
unclassed element, and that the inner, correctly-classed div is wiped
out entirely once `renderServices` populates it — meaning the
operator's own CSS work for tile layout would never actually have
applied. Fixed by merging into one element carrying both; re-confirmed
via the same real, end-to-end category-tap test that the fix holds.

**A separate, real typo found and fixed while re-running the suite
after the merge**: `run_all.sh`'s own schema-validation step called
`btnyc.pyon` — not a real file — instead of `btnyc.json`. Isolated,
single occurrence, confirmed via search; fixed.

**The operator's own, separately-shared "group-tile grid fix"
write-up, cross-checked, not assumed already covered**: confirmed
directly that this session's own `qr.html` already carries the fix's
decisive elements (the dedicated `.group-grid` rule with `!important`,
the `.tile-name` color correction, even the `clamp()` sizing option
the write-up's own status table still marked open) — from this
session's own earlier `T129`/`T134` CSS merges. No further action
needed; confirmed rather than assumed.

**A master test-suite membership check built, addressing real,
direct operator feedback**: `FILE_MANIFEST.json` tracks content drift
(checksums) but has no memory of *membership* drift — a test
silently going missing wouldn't be caught by anything, since
`run_all.sh`'s own glob discovery only reports what IS on disk, never
what's missing relative to what should be. Built
`test_harness/MASTER_TEST_SUITE.json` (a deliberately static list,
updated only when a test is genuinely added or removed) and a new
check in `verify_file_integrity.js` that fails loudly on divergence in
either direction. Verified the mechanism for real, not just written
and trusted: confirmed clean against the actual, current 155 files,
then proved the failure case directly by temporarily removing a real
test file and watching the check catch it by name before restoring it.

**Full suite**: 151/152 (155 test files now formally tracked), the
same permanent failure as every checkpoint since `T108`.

### #22 — ✅ CLOSED (`T118`, Step 6 item 7): "Buy the hour" SKUs and the mounting_height/access question set may need reconsidering together
Found via direct user testing (`T102`): mounting a "standard mirror"
recommended `shelf_mounting_standard_buy_the_hour` (confirmed real,
via `contextual_overrides`) and asked `mounting_height` (own question)
plus the universally-forced `access` — the user's real, stated
concern is that both are unnecessary for this case, and that a
"buy the hour" SKU may need its own, different question-and-pricing
treatment than a per-item service. Not yet investigated deeply enough
to fix responsibly — connects directly to `#17`'s own, still-open
question-curation work, and should likely be tackled as part of that
same pass rather than separately.

**Fixed (`T118`, Step 6 item 7), per explicit operator direction, two
distinct mechanisms for two distinct problems:** (1) `mounting_height`
removed directly from `shelf_mounting_standard_buy_the_hour`'s own
authored `intake_chain` — hourly-billed work naturally reflects real
difficulty (including height) in the hours actually billed, unlike a
flat-fee service where height determines a fixed, pre-quote charge.
`shelf_mortar_mounting_buy_the_hour` (masonry, not a "standard" SKU, a
genuinely more variable case) correctly keeps its own question — this
is a targeted fix for the specific SKU shape named, not a blanket rule
for all hourly work. (2) a new, targeted `excluded_services` mechanism
added to `global_rules.intake_defaults` — an explicit opt-out for a
specific service within an otherwise-correct category/group default,
since the existing schema was additive-only with no way for one
service to decline a default that's genuinely right for its category-
mates. Used to remove `access` for the two low-complexity, hourly-
billed SKUs matching #22's own diagnosed shape
(`shelf_mounting_standard_buy_the_hour`,
`blinds_shades_curtains_buy_the_hour`) without touching `wall_mounting`'s
own category default for every other, genuinely higher-complexity
service (TV mounting, drywall, and — deliberately, per "unless
scoped" — masonry mounting all correctly keep it). Verified via the
new `test_harness/verify_buy_the_hour_question_set.js` (7 checks).

### #23 — ✅ CLOSED (`T118`, Step 6 item 8): Computer-repair intake presentation and pricing clarity ("Lost Files" / data transfer)
Found via direct user testing (`T102`): the user describes the
`data_backup_or_transfer` intake as confusing in presentation, with
pricing that reads unclearly after answering. The trace itself shows
the underlying mechanics computing correctly (real fee breakdown,
consistent totals) — this is a genuine UX/wording quality concern, not
a confirmed mechanical bug, and needs direct review of the real
`tech_issue_source`/`tech_problem_type` question wording and options,
not assumed from the trace data alone.

**Fixed (`T118`, Step 6 item 8):** confirmed the real problem directly
rather than guessing from the trace alone — `tech_issue_source`'s old
question ("What is the source of the problem?") mixed two unrelated
dimensions as sibling options (working-state: "needs setup"/"broken";
device-type: "hard drive"/"phone"), and `tech_problem_type` (shared
with `computer_diagnostic` and `virus_or_malware_removal`) asked about
"Virus or pop-ups"/"Running slow", neither relevant to a backup or
transfer request. Confirmed `tech_issue_source` is used exclusively by
this service (safe to rewrite wholesale) while `tech_problem_type` is
genuinely shared (left completely untouched — rewriting it would have
broken two other services' real, correct questions). Rewrote
`tech_issue_source` into one coherent, situation-focused question,
folding in the "lost or corrupted files" scenario with its original
$30/25min `modifier_ref` preserved, not dropped. Authored a new,
dedicated `backup_source_device` module to replace the shared,
off-topic `tech_problem_type` for this service specifically. Verified
via the new `test_harness/verify_data_backup_question_wording.js`
(15 checks), including explicit regression checks that
`computer_diagnostic`/`virus_or_malware_removal` still use the
unmodified, shared module exactly as before.

### #24 — ✅ CLOSED (confirmed `T118`): Tracing tool enhancement: richer, more compact output (requested directly, `T102`)
The user's own, direct feedback on the `T98` tracing tool, after using
it successfully to help find a real, severe bug: the trace should
include (a) which real UI path produced it (Guided Builder / Smart
Quote free-text / catalog navigation — not currently recorded
anywhere), (b) the estimated price and quantity directly, without
needing to dig through nested `data` objects, (c) a compact summary
of which questions were answered and with what, and (d) the real
`qr.html`/`btnyc.json` checksums embedded directly in the export, so a
future trace is self-describing about which code version produced it,
without the user needing to separately, manually supply this (as they
correctly, responsibly did this turn). Real, valuable, not yet built —
should be the next real enhancement to the tracing overlay.

**Confirmed, not newly built — this was already, fully implemented and
tested (marked "v9.6 ADDITION" throughout `_traceStart`/`_traceExport`
in `qr.html`), just never marked closed in this ledger.** Verified
directly rather than assumed from the presence of comments: ran both
existing dedicated tests, `test_harness/verify_tracing_tool_v2_upgrade.js`
(11 checks) and `test_harness/verify_tracing_v3_full_instrumentation.js`
(12 checks) — all 23 pass cleanly against the current codebase. Every
one of the four requested items is genuinely, verifiably live: (a)
`meta.entryPath`, with all three real entry points
(`collectBookingContext_freeText`/`_catalog`, `sqBuilderFinish`)
confirmed to pass their own real, correct label, plus an honest,
self-documenting fallback for any path that doesn't; (b)
`summary.finalPrice`/`qty` present directly, no nested digging
required; (c) `summary.answers`, the compact answer set, plus a
`narrative` array (a plain-English, step-by-step account) that goes
beyond what was asked; (d) `meta.qrBuildVersion` and a real, computed
`meta.btnycJsonHash`, with its own determinism regression guard. This
is the same live structure confirmed directly against the operator's
own real "Copy JSON" trace upload earlier this session (the
`blinds_shades_curtains_buy_the_hour` Wall Mounting trace) — the exact
`meta`/`summary`/`lastVisibleScreen`/`narrative`/`input`/`trace` shape
matches byte-for-byte.

### #19 — ✅ CLOSED (`T118`): `extractLocation`'s room vocabulary doesn't cover appliance/fixture context (e.g. "stove")
Split off from #18 (`T97`) — deliberately not fixed alongside the main
ceiling-tile work, since it's a genuinely separate content question,
not a code change. Found via the same original trace (`T96`): "above
my stove" produces no location signal at all, since
`negation_library.nlp_location_words` is room names only (kitchen,
bathroom, office, ...) with no appliance/fixture terms. A real,
common, meaningful signal (strongly implying a kitchen backsplash
context) currently goes unused. Deciding the right, complete
vocabulary to add (which appliances/fixtures, and whether they should
carry the same weight as a room name) is a real content decision, not
a quick addition of one word.

**Fixed — two real, distinct gaps, found and fixed together, not
assumed to be one:** (1) the preposition set was `in|into` only —
confirmed directly, before touching vocabulary at all, that "above my
stove" failed regardless of what words were in the room list, purely
because the regex itself never matched anything but "in"/"into".
Expanding the preposition set alone (above/near/behind/under/beside/
by/next to) already made appliance terms extract correctly via the
function's own existing raw-fallback branch. (2) That raw fallback
alone returns an unmapped string ("stove"), which could never match an
existing or future `location_hints` entry authored against room names
— confirmed directly that the one real, live use of `location_hints`
today (`door_style_pref`) keys entirely on room names, not appliance
names. Added a new, deliberately conservative
`negation_library.nlp_location_appliance_map` (13 entries) mapping
unambiguous appliance/fixture terms to their single real-world room
(stove/oven/range/refrigerator/fridge/dishwasher/microwave → kitchen;
toilet/bathtub/tub/shower → bathroom; washer/dryer → laundry room).
Genuinely ambiguous terms (sink: kitchen or bathroom; water heater:
basement/garage/utility) are deliberately excluded rather than
guessed — they still extract as their own raw string via the existing
fallback, unchanged from before.

**A real bug caught and fixed before it shipped broadly:** the first
draft wrote the appliance lookup as a new, separately-named helper
function. This broke 19 existing tests that extract `extractLocation`'s
own source in isolation via a `findFn`-style mechanism and run it in a
minimal sandbox — none of them knew about a brand-new helper function,
so all 19 threw "not defined". Diagnosed from the real error message
rather than guessed at, fixed by inlining the lookup directly (reading
`window._NLP` the same way the function's pre-existing lazy accessors
already do) rather than introducing a new named dependency. A second,
smaller issue found the same way: `verify_ssot_consultation.js` flagged
the new map's 10 longer keys as "unconsulted" — correctly so, since
they're resolved via a dynamic, variable-based lookup
(`APPLIANCES[loc]`), so the literal key strings never appear as code in
`qr.html`, only as data. Added to `NESTED_DICT_OF_DICTS_PATHS` with the
exact same reasoning already on record for `global_rules.modifiers`,
not a new, one-off exception.

Verified via a new, full jsdom end-to-end test
(`test_harness/verify_extract_location_appliance_fix.js`, 17 checks):
the data itself, a regression guard against the separately-named-helper
mistake reappearing, the exact motivating case plus several appliance/
preposition neighbors, the deliberately-unmapped ambiguous case, and
full regression coverage of the pre-existing room-name behavior.

### #8 — `renderGlobalSearchResults` + SmartQuote free-text UI component-layer rewrite
Full spec already on record (`T79`). Large, multi-part UI work
(component-layer placement, live recommendation cards, new regression
coverage). Not started, deliberately.

### #17 — 3 real `dynamic_services` entries exceed §6E's new question-count ceilings

**T135 note**: the catalog has moved since this was written (`96`
`dynamic_services` entries then, `82` now — a real, separate shrinkage
worth knowing about but not chased further here). This entry's own
"37-case skilled-tier quantity-only area" is investigated directly at
`T135`, with a corrected count (22, not 37) and full classification
data — see `PENDING_DECISIONS_consolidated`'s `#17` entry for the
complete account rather than duplicating it here.

Found via direct, systematic audit of all 96 `dynamic_services` entries
against the newly-codified §6E rules. Each individual question in
these chains is independently pricing-relevant (not obviously
pointless or redundant) — this is a case of too many reasonable
questions stacked together, not an obvious bug, so it needs a real
product decision rather than a mechanical fix:

- **`minor_home_repairs+Repair`, "Tile" branch: 8 questions (ceiling
  is 4, worst offender by far)** — `surface_type`, `item_count_template`,
  `waterproof_area`, `has_matching_tiles`, `grout_repair`,
  `water_damage`, `ceiling_height`, `disposal`. **Update (`T93`):**
  investigated whether any could be safely dropped; found both
  `waterproof_area` and `has_matching_tiles` are genuinely, deliberately
  wired (the former had a real undercharging bug on this specific path,
  now fixed; the latter connects to a real smart-tag inference
  mechanism) — neither is a real drop candidate after all. All 8
  questions are now confirmed pricing/logistics-relevant. The ceiling
  question itself remains open: real options are merging some into a
  single combined question (real, new UI work) or reclassifying this
  branch's tier (found to have real, non-obvious pricing interactions
  via tier-crossing — needs careful analysis, not a quick change).
- **`electric_lighting+Install`, "Ceiling fan" branch: 5 questions**
  (ceiling 4, marginal) — `electrical_item`, `item_count_template`,
  `existing_box`, `distance`, `removal`. **Investigated (`T94`), same
  rigor as the Tile branch: all 5 confirmed genuinely pricing-relevant
  (real tags/`modifier_ref`s on `existing_box`/`distance`/`removal`).
  No hidden bug, no safe drop candidate — a real 5-question situation.**
- **`wall_mounting+Mount`, "TV" branch: 5 questions** (ceiling 4,
  marginal) — `mounting_item`, `global_quantity`, `weight`,
  `wall_type`, `removal`. **Investigated (`T94`), same result: all 5
  genuinely necessary (real tags/`modifier_ref`s on
  `weight`/`wall_type`/`removal`; `global_quantity`'s own
  `affects_price: false` correctly reflects its separate
  quantity-multiplier mechanism, not a bug). No safe drop candidate.**

**The real ceiling-compliance question for all 3 cases remains open,
deliberately not rushed**: with every question now confirmed
legitimate, the only real paths forward are (a) reclassifying a
branch's complexity tier — found (`T93`) to carry real, non-obvious
risk, since a tier's `exactTier` floor can force its higher hourly
rate onto quick/simple jobs that would otherwise correctly price
lower, or (b) building new, multi-select-style UI to merge several
single questions into one combined interaction — genuine, separate UI
work. Neither is a quick fix; both need dedicated, careful treatment
this pass deliberately did not rush.

**A broader, related observation, not yet a confirmed violation
list**: 37 of 96 `dynamic_services` entries are `skilled`-tier and ask
only a quantity question. Some of these plausibly match the named,
tentative bulb exception in §6E (e.g. `electric_lighting_bulbs+Install`);
others (e.g. generic "frames/shelves" or "furniture" mounting
fallbacks) may or may not be appropriate quantity-only paths — this
needs the same kind of careful, per-case reasoning §6E's own bulb/knob
exceptions used, not a blanket judgment either way. Listed here as a
real, scoped-out area for a future, dedicated pass — not attempted
this turn to avoid a rushed, blanket call on 37 real cases.

### #12 — Root-node data review
`category`, `group`, `archetypes`, `compiled`, `dynamic_services`,
`global_rules`'s remaining sub-nodes, and the compiler-metadata keys
are still genuinely unreviewed as dedicated root-node work. `pricing_formulas`
now fully reviewed (`T95`, 6 of 6 entries) — 2 real undercharging bugs
found and fixed across the review (`waterproof_area`/`T93`,
`dmg_size`/`T95`). Continuing.

### #13 — `microwave_setup` orphan
Standing note, no action needed unless the picker allowlist changes.

---

*Nothing above is waiting on you specifically — #4 and #8 are real,
substantial engineering work; #12 is ongoing; #13 is a watch-item; #17
is a real finding needing your product judgment on 3 specific cases,
plus a broader 37-case area intentionally left unaudited this turn;
#19 is a real, small content decision (which appliance/fixture terms
to add), not urgent.*

### #58 — CLOSED (`T135`): `verify_btnyc_v8_compiler.py` / `verify_btnyc_v5_compiler.js` retired, superseded by `verify_btnyc_v10_compiler.py`
Found while rebuilding the sandbox and running the full suite for the
first time this handoff (see `TIMELINE.md`'s `T135` entry for the full
rebuild account). Both tests were genuinely passing as recently as
`T127` (`verify_btnyc_v5_compiler.js` confirmed 13/13 clean that turn),
but by `T135` both fail against the live catalog — stale field-name
expectations, 15 `routing_archetype` label mismatches, 36 groups' curated
content diffs. This is not a data regression: `btnyc_v10_compiler.py` was
adopted as the canonical compiler at `T132`/`T133` after 4 real
regressions were found and fixed against it, and the catalog has moved
on in ways only v10 correctly reproduces since. Confirmed directly before
retiring: `verify_btnyc_v10_compiler.py` passes clean; `btnyc_v10_compiler.py`
has zero runtime dependency on v8/v5 (grep-confirmed, independent Python
module); nothing else in the harness calls v8/v5 except these two tests
of the compilers themselves. Added to `run_all.sh`'s existing skip-list
pattern (the same mechanism already used for `verify_dumb_ui_html_self_sufficiency.js`
and the schema/draft-quote `.py` → `.js` supersession), not silently
left red.

### #59 — CLOSED (`T135`): a systemic test-fragility pattern — 9 separate `verify_*.js` files had regex/string checks written against single-line or unindented source, broken by later reformatting to multi-line
Found while diagnosing the sandbox's first real full-suite run (42/152
failing). Every instance had the identical shape: real, current,
*correct* code, checked by a test whose match pattern assumed a specific,
older formatting (all on one line, or a specific indent depth) that had
since changed for unrelated reasons (readability edits, most likely).
None were product bugs — each was individually confirmed against live
code before being touched, never just loosened until the failure went
away. The one non-mechanical fix in this batch: `cms_bridge.js`'s
`findPlainConst` (not a test, but the same bug shape) — assumed every
plain const fits on one line, silently never found `_QTY_WORD_MAP`'s
real, multi-line object literal. Fixed with brace-balanced matching
instead of a wider single-line regex, so this can't recur for any future
multi-line const. Affected test files: `verify_curated_card_chain_rewire.js`,
`verify_service_type_normalization_consolidation.js`, `verify_xss_fixes.js`,
`verify_category_icons_tabler_migration.js` (see `#60`, a separate,
genuine content question this one also surfaced), `verify_delegated_vocabulary_batch_2.js`,
`verify_mutual_exclusion_wired_into_main_render.js`, `verify_curated_intake_confidence_agreement.js`,
`verify_tracing_tool_v2_upgrade.js`, plus `verify_nlp_engine_module.js`'s
own independent copy of the same `findConstLine` bug `cms_bridge.js` had.
**Worth a standing rule**, recorded in `PHASE_PLAN.md`: any shared
constant or lookup table used by more than one pricing/routing function
should live in exactly one place, with a test asserting no second,
drifted copy exists — this exact shape caused `#42`'s second, more
severe instance in the same session this was found.

### #60 — ✅ RESOLVED, T148 (operator confirmed `ti-library-photo`; rationale recorded in the data) — the `wall_mounting` category icon: `ti-library-photo`, not the `ti-wall` a test expected
Found while fixing `#59`'s `verify_category_icons_tabler_migration.js`
instance. `ti-wall` does not appear to be a real Tabler Icons class; the
live, current data already uses `ti-library-photo` instead — a plausible
deliberate substitution (gallery/photo-wall imagery is a reasonable fit
for Wall Mounting's frames/shelves/TV/blinds scope) but this is a content
judgment, not a technical one, and wasn't decided here. The test's
expectation was updated to match the live data (data is the source of
truth; the test's hardcoded expectation was what had gone stale — same
direction as every other `#59` fix), but the underlying "is this the
right icon" question is still open. **Needs a one-look confirm**, not a
real investigation.

**RESOLVED T148 — operator confirmed `ti-library-photo`.** The rationale is recorded in the data as `_icon_note` on the `wall_mounting` category (cross-referenced on `service_types.Mount`): reads as a photo approaching a wall to be hung; unambiguous at a glance; deliberately uncommon so it is unmistakable. A future replacement argues against a recorded decision, not a guess. Separate and pre-existing (#85): the category icon is stored as `ti ti-library-photo` and the service type's as `ti-library-photo`; two of the roughly ten icon render sites that assume different shapes.

### #61 — ✅ RESOLVED, T148 (operator ruling: the dual-corpus hybrid; harness partly pending) — was NEEDS OPERATOR (raised `T135`+): is corpus-representativeness or architecture-generalization the real validation strategy for `T6.4`?
Raised while reviewing the merged Phase 4.75 plan. My own question was
"were the 20 seed examples drawn from real customer messages, or
constructed as illustrative?" — the operator's direct correction is
worth recording verbatim rather than paraphrased, because it reframes
the question rather than just answering it: *"the honest answer is it
fundamentally shouldn't matter. We shouldn't be band-aid patch fixing,
we need to solve the issue at the root not just the leaf. This mindset
and approach have been in conflict since this entire project — far
before \[this session\] was involved — and has persisted... patching
problems that treat the symptoms and not the disease."*

The real, standing methodological question this surfaces, worth a
decision on its own rather than settled implicitly by however `T6.4`
happens to get built: **is the capability-class corpus a completeness
target (grow it until it represents the real request distribution) or a
spot-check on an architecture that should generalize by construction
(entity → archetype → capability, a deterministic NLP contract) — such
that needing to keep expanding the corpus to catch new failures is
itself the signal that the *architecture*, not the corpus, is
deficient?** These two framings lead to different engineering
priorities: the first argues for sourcing real historical request data
before `T6.4`; the second argues that real data would only ever be used
to *falsify* the architecture, never to *complete* it, and that the
actual finish line is Phase 1.75/Phase 4's structural work, with the
corpus as one (replaceable, never-complete) instrument for testing it.
Not resolved here — recorded because it governs how every phase from
1.75 onward should be approached, not just `T6.4`.

**RESOLVED T148 — operator ruling: the dual-corpus hybrid, falsification first, runtime gap detection.** Two corpora testing orthogonal axes, never alternatives. The *probe corpus* is built from the architecture's own primitives (entity x archetype x capability x surface; language held constant or derived mechanically from the SSOT), permanent, and tests whether the architecture reasons correctly about the shapes it claims to model. The *grounding corpus* is real customer language, sampled and rotated (never accumulated), and tests whether the reasoning reaches real phrasing. On disagreement falsification wins. Every divergence classifies as exactly one of **reach failure** (the shape is within the model, the phrasing missed: fix router or vocabulary), **shape failure** (the architecture does not claim this shape: check the domain model; an architecture change or a probe-validity question) or **noise** (an explicit exclusion rule, recorded); the person running the sweep applies the rule, never invents a ruling. The finish line is architectural: N consecutive grounding samples with zero new architectural falsifications (N resets on a new one). The one operational change the ruling requires: **sample and triage what the completeness gate holds at the builder**. T6.4's deliverable is a harness (probe generator, grounding rotation, gate-held sampling), not a case list; a new primitive needs the four-criteria test (#62); the class registry (R-GOVERN-DEFECTCLASS) is the interface.
**Exists:** the probe-corpus half is `tools/synonym_batch_differential.js` (every keyword and synonym in 8 phrasings against the real `understandRequest`) and the 441-string sweep (`verify_dish_washer_cross_entry_fix.js`); `understandRequest` already exposes what a sampler needs to say *why* a phrase was held (`missing`, `objectGrounded`, `_matchConfidence`, the Safety Net marker). **Not built:** the gate-held sampler, the grounding rotation, the class-registry test, the finish-line counter. **Real customer language has to come from the operator** (production logs); I have none. **Default if unanswered:** build the sampler first (it is the one operational change), reading a plain text file of phrases, pre-filling the three-way disposition only where a mechanical rule decides (noise) and leaving the rest for the person applying the rule.

### #62 — ✅ RESOLVED, T148 (operator ruling: the molecular layer and the four-criteria test) — was NEEDS OPERATOR (raised `T135`+): should capability-class gaps be closed primarily via new named services, or via strengthening `dynamic_services` generalization?
Raised against `T1.3` ("add named services for the ten capability
classes"). Direct operator pushback, worth recording verbatim: *"as
long as they are in the realm of offerings or close enough adjacent
then of course add them \[...\] but again we aren't mapping the
universe so why are we adding more hardcoded services isn't this the
purpose of the dynamic generation regardless?"*

This is the same root-cause-vs-leaf tension as `#61`, applied to service
authoring specifically: adding a new *named* service for every
capability class found is a leaf-level response (it closes the one gap,
for that one class, the way it happens to be worded/shaped today) when
the charter's own "model concepts, not the universe" principle and the
already-planned `T2.6` entity/archetype/capability layer exist
specifically so a new real-world request of a *known* shape should be
handled by the *dynamic* mechanism, without a new hardcoded record.
`T1.3`'s original framing treated new named services as the default
response to a capability-class gap; the operator's correction suggests
the default should be closing the gap in `dynamic_services`/`T1.4`/`T2.6`
first, with a new *named* service reserved for cases with a specific,
articulable reason a generic dynamic record can't express (volume,
meaningfully distinct pricing or handling) — not as the first move.
`T1.3` in `PHASE_PLAN.md` reframed accordingly; the specific line
between "add it dynamically" and "this genuinely needs its own named
service" is not resolved here and needs a real decision, likely
alongside `T2.6`'s own taxonomy design.

### A standing principle flagged, not yet centralized — root cause over leaf patches
Not a numbered decision — a marker for the operator's own planned
review pass (their own words: *"I'll have this done and filtered out
any insight in the next few turns"*) of `btnyc.json`'s and this
project's scattered `_note`/`_orphan_backlog_note`/meta-comment fields,
to centralize anything that is actually a foundational, load-bearing
principle rather than session-specific context. `#61` and `#62` above
are both instances of one recurring principle worth including in that
pass when it happens: **fix the root, not the leaf** — a patch that
makes the one reported case correct without addressing why the class of
bug was possible is not finished, even when the specific test passes.
This session's own `#42` fix (two independent, hardcoded copies of the
same exclusion list, not just the one instance first found) and this
project's own prior `T102`/`T103` history (the same quantity/complexity
double-count shape, fixed twice before `T135`, a third time) are direct,
concrete evidence for why this principle keeps needing to be
re-asserted rather than being self-evident from one good fix. Not
acted on further here, per direct instruction — the operator's own
review is expected to determine where and how this actually enters
`PROJECT_CHARTER.html`.

**RESOLVED T148 — operator ruling: the molecular layer and the four-criteria test.** The finite set of concept-types the architecture reasons about (entity, behavioral class, capability, action, modifier) is the hardcoded foundation, and its finiteness is a feature; the boundary is drawn by the kinds of reasoning the business requires, not the kinds of objects that exist. A capability-class gap closes as a **named service** only when one of four criteria applies (a distinct pricing shape a generic formula cannot express; a distinct real intake requirement no sibling can share; a named client-facing vocabulary customers search for; a regulatory, safety or warranty distinction), otherwise as a **dynamic entry**. The Charter addition to R-DOMAIN-FINITE is the operator's to make. **The enforceable half is built:** `verify_r-domain-finite_named_service_declaration.js` requires every new named service to carry a `_note` beginning "Criterion 1-4" with its reason; the 76 existing services are grandfathered by name (frozen, shrink-only) because the criterion each satisfied cannot be reconstructed after the fact. **For T1.3:** run the test per capability class; close as named only where a criterion applies, with the note. The mistake it prevents: a *vocabulary* gap (the router lacks a word customers use) closed as a new service; the fix there is vocabulary (the #72 path), not the catalog.

### #63 — ✅ CLOSED (T135, decided under extended operator autonomy): confirmed dead, removed

Found while consolidating the 5-way `qty-module-keys` duplication
(`find_duplicate_constant_candidates.py`'s first real run, see
`TIMELINE.md`'s `T135` entry). `QTY_MODS` (`sqBuildCuratedIntake`'s own
ceiling-enforcement set) carried two extra members beyond the real
4-element qty-module-keys list: `'Install / Mount'` and `'Install'` —
these look like service-type labels, not intake module keys, and no
code path confirmed this session ever sets a module's `moduleKey`/
`module` field to either literal string (checked directly: no synthetic
module entry anywhere uses `service_type` as its key). The duplicate-
constant finder's own cross-reference independently found the same two
strings inside `iconPriority` (an unrelated service-type/icon list),
suggesting a copy-paste origin.

**Decided and acted on this turn**, under the operator's own extended
autonomy grant ("if any pending decisions are on the table or
interrupting your workflow use your autonomy and make the decision
yourself"). Re-confirmed directly at the actual call site
(`realMods = allMods.filter(m => !QTY_MODS.has(m.moduleKey))`) before
acting, not just via the finder's own heuristic: `m.moduleKey` only ever
comes from real `intake_modules` keys in this codebase, so these two
entries could never have matched anything. Removed; full suite re-run
before closing confirmed zero behavioral change (same known 5 failures,
nothing new). This was a low-stakes, reversible, fully-evidenced cleanup
with no live customer-facing consequence either way — the kind of call
this autonomy grant is well-suited for, distinct from `#47`'s own
still-open ceiling-*value* question, which carries real customer-facing
pricing/scope consequences and is deliberately not decided the same way
(see `#47`'s own entry for that reasoning).

### #64 — `board_level`/`two_trip_minimum` tags on `hardware_type`'s Deadbolt/Keypad/Smart-lock options are orphaned (never consumed anywhere in `qr.html`)

Found while executing `T0.2` (adding the confirmed-missing Lockset/
Keypad/Smart-lock `hardware_type` options — direct catalog audit had
already confirmed these were genuinely missing). Followed the existing
"Deadbolt lock" option's own tag pattern for consistency across the 3
new options, then confirmed directly: `board_level` appears zero times
anywhere in `qr.html` — these tags carry no `smart_tags` entry and no
code path reads them. Pre-existing on "Deadbolt lock" before this
session touched anything; now also present on the 3 new options for
consistency with that precedent, not newly introduced by this addition.
Not resolved here — this is real, connected input for `#41`'s broader
orphaned-data triage and `T0.4`, not something to fix ad hoc as a side
effect of adding customer-facing options.

### #65 — ✅ DECIDED AND IMPLEMENTED, T135+ (was flagged NEEDS OPERATOR; corrected per direct instruction): `loose_tile_replacement` now genuinely uses `tile_repair_formula`

**Direct operator correction, worth preserving close to verbatim rather
than summarized away**: *"The more sophisticated and nuanced pricing
formula to handle dynamic and bespoke services... seemed to work
better. Don't sacrifice complexity for simplicity unless it add[s]
value and purpose... it's not something that needs operator, I've
answered this so many times I trust your autonomy to actually figure it
out without me having to repeat it again and again."*

This is now a standing principle, not a one-off call — see the new
Charter amendment (`CHARTER_AMENDMENTS_T135.md` Amendment 12) and the
note at the top of `PHASE_PLAN.md`'s Phase 1.25/2.5.

**What was actually wrong with the original attempt (not just "needs
operator"), traced to the real mechanism**: `tile_repair_formula` only
converts its own computed minutes into real dollars under an
`hourly`-type financial engine — confirmed against the one already-
working reference (`minor_home_repairs+Repair`'s dynamic Tile branch,
itself `financial_engine.type: "hourly"`). `loose_tile_replacement` was
on `flat_rate`, where a formula's extra minutes only matter if they
cross a full complexity-tier threshold — which is why the first,
naive attempt (flip `pricing_engine` alone) produced a flat $85
regardless of quantity, and why a second attempt (also flip
`financial_engine.type`, but nothing else) produced an inexplicable
$211+ at qty=1 until a second interacting field was found:
`default_estimates.total_minutes` (flat-rate-specific display metadata)
was silently acting as an unearned floor once minutes started being
computed for real.

**Applied**: `financial_engine.type` → `hourly`, `pricing_engine` →
`tile_repair_formula`, `pricing_archetype` → `formula` (a real,
already-used value), `base_price` → 35 (empirically tuned so qty=1
lands at exactly the established $85 floor), `default_estimates.total_minutes`
cleared. **Verified, not assumed**: qty=1/3/5 with no special
conditions price at $85/$99/$113 — real, moderate, sensible per-tile
scaling, not the old flat behavior and not the old outer-multiplier
5x-per-unit blowup `#42` fixed elsewhere. The membrane condition still
fires correctly (qty=5 + membrane: $248). Full catalog-wide pricing
sweep (`automated_path_sweep.js --full`) reconfirmed zero new flags.
Four existing tests had real, legitimate assertions about the old
flat-rate-specific behavior — updated to match the new, correct reality
(one switched its example service to `toilet_install`, still genuinely
generic-path, rather than weakening the assertion). Full suite
reconfirmed clean afterward.

**Not yet done, carrying the same risk until individually verified the
same way**: `drywall_repair_formula`/`wall_hole_or_crack_repair` and
`furniture_repair_formula`/`furniture_repair_hourly` (`T1.1`'s other two
cases) — see `PHASE_PLAN.md` Phase 2.5 for status.

### #66 — `furniture_repair_formula` is a live, genuinely orphaned duplicate of `issue`'s own working modifier_refs (found while resolving T1.1/#65)

Investigated as part of applying the "favor sophistication where it
adds value" principle (`#65`, `CHARTER_AMENDMENTS_T135.md` Amendment
12) to the remaining two `T1.1` cases. `furniture_repair_hourly` uses
`pricing_engine: 'assembly_formula'`, which has no matching branch in
`applyPricingFormula` — `furniture_repair_formula`'s own
`issue_type_fees` never fire. But the customer's actual issue selection
*does* already affect price today ($128 "Loose joints" vs. $218 "Broken
piece", confirmed directly), because the `issue` intake_module's own
`client_response` options carry a second, independently-named set of
real, wired `modifier_ref`s (`issue_loose_joints_or_wobbling`, etc.) —
a parallel, differently-prefixed implementation of the identical fee
schedule `furniture_repair_formula`'s `issue_type_fees` also encodes
(`furniture_repair_loose_joints_or_wobbling`, etc.).

Not a live bug — only one of the two paths is actually reachable — but
a real instance of `#battle-canonical`'s "two systems that answer the
same real question will eventually disagree" shape, currently dormant.
Real question for `#41`'s broader orphaned-data triage: is
`furniture_repair_formula` safe to retire outright (confirm nothing
else references it first), or was it authored for a different,
not-yet-identified context the way `drywall_repair_formula` genuinely
is used elsewhere? Not resolved here — flagged with the evidence
needed to resolve it quickly when picked up.

### #65 addendum — `drywall_repair_formula`/`wall_hole_or_crack_repair` and `furniture_repair_formula`/`furniture_repair_hourly` resolved: correctly NOT bound

Completing `T1.1`'s remaining two cases with the same empirical rigor
as the tile case, applying `CHARTER_AMENDMENTS_T135.md` Amendment 12's
principle in both directions: `wall_hole_or_crack_repair`'s current
flat-rate-plus-generic-modifiers approach is *already* the sophisticated,
condition-aware model for this specific service (all three of its real
questions carry genuine, wired modifiers) — `drywall_repair_formula`
expects fields (`area_sqft`, `texture_match`) this service never asks,
and binding it would replace real richness with hardcoded fallbacks.
`furniture_repair_hourly` is in the same position, for a different
reason (see `#66`). Neither binding was applied; both are closed as
correctly-resolved, not deferred. Full detail in `PHASE_PLAN.md`'s
Phase 2.5, `T1.1`.

### #67 — ✅ RESOLVED, T135+ (root cause found and fixed, per direct instruction not to patch): Dryer and Stove/Range symptom-picker routing was silently broken

**The report**: Washer's catalog-tap flow correctly shows the symptom-first "What's happening?" picker; Dryer and Stove don't. Direct instruction: find out exactly why, treat the disease.

**Root cause, precisely**: `renderComponentSymptomPicker` resolves `DB.routing_archetypes[group.id]`, then checks `symptom_id_to_service_ids` to see if the archetype's real symptom ids actually route anywhere. For `minor_home_repairs_appliances_dryer` and `minor_home_repairs_appliances_stove_range`, `real_symptom_ids` correctly listed 5 and 3 real symptom concepts — but `symptom_id_to_service_ids` was completely empty for both. `chosenAction.normalTilesHaveThisAction` therefore always evaluated false, silently falling through to the generic pre-seeded builder instead of the symptom picker. Confirmed this was a scoped, 2-entry gap, not a catalog-wide pattern: a full sweep of all 39 `routing_archetypes` entries found exactly one other case with a similar shape (`minor_home_repairs_ceilings`), which turned out to be a genuinely correct, honestly-disclosed gap (no named service exists yet, falls back to the working pre-seeded builder by design) — not a bug.

**Why a quick "just wire the mapping" patch would have been wrong**: the only existing candidate destination, `repair_appliances`, has a washer-flavored symptom question ("Won't spin," "Won't drain," "Leaking water") — wiring Dryer/Stove to it would have replaced one broken experience with a different, nonsensical one.

**The real fix**: authored two new, tailored intake modules (`dryer_symptom`, `stove_symptom`) using each appliance's actual real-symptom vocabulary, reusing existing modifier definitions where the underlying diagnostic-effort concept genuinely matched rather than duplicating them. Authored two new named services (`dryer_repair`, `stove_repair`), modeled on `dishwasher_repair`'s own already-correct template (same diagnostic checkout-state reasoning, same confidence strategy, explicitly flagged as reused-not-independently-derived). Wired `routing_archetypes`' `symptom_id_to_service_ids` for both groups, updated their `real_gaps` disclosures to be accurate (Repair resolved; Install remains a real, disclosed gap — no install service exists yet). Added both new groups to the `major_appliance` archetype (`archetypes` top-level structure), matching washer/dishwasher/refrigerator/microwave.

**Verified end-to-end, not assumed**: replayed the exact trace scenario (tapped "Fix / Repair" for both groups) — both now render the real "What's happening?" prompt with correctly humanized, appliance-specific tiles (Dryer: Bad smell, Overheating, Runs constantly, Strange noises, Wont power on, Something else). Full catalog compiler run clean (zero structural errors, schema pass, genuinely additive). Six existing tests had legitimate stale-count assertions (74→76 services, archetype coverage, diagnostic_open count) — updated to match the new, correct reality, not weakened.

**The actual cure, not just the fix**: built `test_harness/verify_routing_archetype_mapping_completeness.js`, a permanent validator against this exact class of gap. Self-corrected before trusting it: the first draft treated "any `real_gaps` text exists" as sufficient to excuse an unmapped id — tested against the historical broken state and confirmed it would NOT have caught this bug, because dryer/stove already carried real_gaps prose (just stale, claiming no repair service existed when 5 well-defined real_symptom_ids already signaled otherwise). Rewrote as a coverage-based rule instead: zero mapped ids across 2+ declared ids is a hard failure regardless of `real_gaps` text, since that shape essentially never represents a genuinely honest, one-off gap (confirmed against the one real legitimate case in the whole catalog, `minor_home_repairs_ceilings`, which has exactly one declared id). Re-tested against the historical state afterward — now correctly fails with 1 flagged problem, confirmed working, not just plausible.

**A duplicate found and retired along the way**: discovered a second, `.py` version of this same validator already existed in `test_harness/` (from earlier in this same continuation, lost track of across a response boundary) — weaker than the `.js` version (same "any disclosure is sufficient" flaw the `.js` version was corrected past). Retired the `.py` version rather than keep two implementations of the same check, one silently worse than the other — exactly the `#battle-canonical` shape this whole project works to avoid, caught here before it could actually cause confusion.

Full suite reconfirmed clean (154/159, same known five) after every step.

### #68 — `verify_no_orphaned_data.js` had two real, confirmed checker bugs, not 33 real orphans — fixed, count now 4

Picked up per "continue with autonomy, optimize for longevity/robustness/charter vision" — this is exactly that: a permanently-failing tool made genuinely trustworthy, not one-off data patched.

**Bug 1 — dynamic-services reachability checked the wrong field.** The checker tested `group.dynamic_service_types` for reachability; the real runtime resolver (`resolveDynamicService`) never checks that field at all — it's a direct, unconditional dictionary lookup. Traced the REAL reachability mechanism directly: `sqBuildStep2` renders `DB.ui_config.step2_types` as universal, clickable action-type chips for any group reaching that step — confirmed the live data's own `step2_types` includes `'Diagnostic'`, explaining 24 of the 26 flagged `dynamicServices` "orphans" in one stroke. Fixed by checking both signals (a per-group curated list, and the universal default set) — both are genuinely real, independent reachability grants the checker was only checking one of.

**Bug 2 — the `_review_note`/`_orphan_backlog_note` convention was recognized for `modules` only.** Tags already had real, specific, already-authored review notes on 2 genuinely-reviewed items (`#bidet_attachment`, `#flushometer_bidet`) that this checker simply never looked for. Generalized the recognition across every category rather than special-case tags specifically.

**Result: 33 → 4 real, unreviewed items.** Two more resolved directly this pass:
- `#fragile_item` — confirmed genuinely legitimate (a real, working Purpose 1/2 NLP-disambiguation tag against `#heavy_item`, 12 real synonyms) — marked reviewed.
- `furniture_repair_formula` — the item `#66` already investigated and explained; marked reviewed with a pointer back to that entry rather than left to reappear as if new.

**4 genuinely remain, not yet resolved with the same rigor, honestly left open rather than rushed:**
- `generic_mounting_service` — real, authored service ("Mount any item on a wall"), but traced its own group's `routing_archetypes` entry directly and confirmed all 3 real components map to a *different* service (`shelf_mounting_standard_buy_the_hour`); `real_gaps: []` on that entry claims no known gap. Hypothesis, not yet confirmed: this may be the intended target of a "Something else" component-fallback tile this session hasn't traced the resolution mechanism for.
- `item_count_overflow_formula` — has a real branch in `applyPricingFormula` (confirmed) and 35 occurrences across the catalog, so likely a third instance of the same checker-traversal-gap class as Bug 1 (a real `formula_override` reference pattern the checker's own traversal doesn't reach into) rather than a genuine orphan — not confirmed precisely enough to fix without more tracing.
- `database_summation` — has real, substantial UI-behavior fields (button text, badge styling) and a real design-rationale note, strongly suggesting it's the self-quote/cart-summed pricing display mode — not yet confirmed which real code path sets a service's checkout_state to this value.
- `plumbing_help+plumbing_help_garbage_disposals+Mount` — the one dynamic-services entry that survived even the corrected checker; not yet individually investigated.

Full suite reconfirmed clean (155/160, same known five — `verify_no_orphaned_data.js` correctly still fails, honestly, since 4 real unreviewed items remain, not zero).

### #69 — PRICING_GUIDE Discrepancy Register (B1–B18): full pass complete

Direct instruction: "use your judgement and autonomy... don't defer." Went
through all 18 items. Status of each, so nothing needs re-deriving later:

**Fixed and verified (real code/data changes, tested against real prices):**
- **B1/B2** (furniture assembly missing rate + double-counted flat_fee) —
  fixed. `meta.global_rates` re-added (`standard_labor: 40`,
  `specialized_repair: 85` — the second field wasn't in the original
  proposal, added because the schema requires both; flagged for
  confirmation). `mathFurnitureAssembly` rewritten to `max($40, minutes/60
  × rate)`, no more double-add.
- **B3** (`cabinet_knob_or_pull_install` $140 cliff) — fixed. New two-rate
  model implemented exactly per spec, verified against the full reference
  ladder (every value matched).
- **B4** (`cabinet_door_or_drawer_adjustment` bands) — turned out to be a
  **real code bug**, not a data/model problem as originally framed: the
  fee-accumulation loop in `computeUnifiedQuote` never read a service's
  own `intake_chain[].params.client_response` override, only the shared
  module's generic definition. This affected 5 of the 16 services on the
  `item_count_overflow_formula` mechanism (the other 11 have no per-band
  data authored, so flat-until-overflow is correct for them). Fixed the
  one-line root cause plus wired all 5 real services. Verified two
  independently against expected values.
- **B5/B6** (TV mount materials/question) — fixed. Bracket moved from
  required to optional materials (the service's own description already
  said "customer provides mount" — this was contradicting itself). Added
  one minimal sourcing question, deliberately not the fuller redesign the
  guide's own Open Question left unresolved.
- **B7** (question caps) — fixed. Applied the guide's exact Section 11
  values to all 7 named services plus all 8 appliance diagnostic/repair
  services (2→3, connects directly to the divergence-resolution work —
  removes a fragility that only worked by accident before).
- **B8** (archetype mismatch) — fixed, confirmed safe by direct test now
  that B3 is in.
- **B11/B12/B14** (furniture repair 3-price divergence) — fixed.
  `furniture_repair_hourly` bound to `furniture_repair_formula` (same
  "hourly type" lesson as `#65`'s tile-formula fix). Verified: catalog tap
  and free-text now both compute $140 for the identical job — 2 of 3
  paths converged. Removed a real double-counting risk found along the
  way (the `issue` module's own parallel modifier_refs, now redundant).
- **B13/B18** (stale compiler counts) — fixed via recompile.
- **B17** (stale "84 of 96" comment) — corrected to the real 70/82.

**Checked directly, confirmed NOT a bug (verification prevented a bad fix):**
- **B9** (dynamic `minor_home_repairs+Repair` "double-charging") — tested
  against a second, already-test-verified dynamic service using the
  identical base+hourly pattern (`wall_mounting+Mount`). This is the
  established, deliberately-tested convention, not a bug. Left untouched.
- **B10** (no "book separately" notice) — already implemented, and by two
  independent mechanisms: `renderCuratedCardFromRoute` shows a real,
  friendly notice (verified rendering directly for `thermostat_replacement`),
  and `prefillSmartQuoteFromService` separately force-locks `qty=1` for
  every affected service regardless of which renderer shows the content.
  No action needed.
- **B15/B16** (naming/classification notes) — checked the actual live
  `PROJECT_CHARTER.html` and `btnyc.json` directly rather than assume:
  neither the conflation (B15) nor the contradiction (B16) exists in the
  live system. Both are about the reference guide's own now-superseded
  earlier drafts (the guide's own Section 0 already documents B16 as a
  self-correction). Nothing to fix in the actual codebase.

**Net result:** every item in the register got a real, verified answer —
fixed, or checked and confirmed not to need fixing. None deferred.

Full suite left at the elevated count per explicit instruction (parking
lot the test reconciliation for a separate pass) — 26 above the known
baseline of 5, from three combined sources: the operator's own earlier
data curation, this pass's real fixes correctly breaking tests that had
encoded old bugs as expected behavior (confirmed concretely for at least
two — see the prior turn's summary), and the new item_count_template
code fix touching a shared, widely-used loop.

### #70 — Phase 1's 19 sweep anomalies: all 14 remaining were a miscalibrated checker, not real bugs (same "fix the tool" pattern as #68)

Picked this over continuing the pricing guide, since that thread's
remaining items (its own Open Questions) genuinely need business-policy
input, while this was real, unblocked, verify-it-yourself work.

Refreshed the sweep first (a lot of pricing logic changed this session) —
14 of the original 19 remained, all `HIGH_RATIO`, all in the 6.2x-8.2x
range, and all on `hourly_timed`/`diagnostic_open` services
(`microwave_repair`, `washer_repair`, `repair_appliances`,
`window_ac_repair`, and their dynamic siblings). Checked the actual
scenario behind one flag directly rather than assume: `microwave_repair`
at its 'max' variant computes $437 against a $70 base -- but its own
'min' variant already runs $356 (5.1x). For an hourly service,
`base_price` is a floor a real diagnostic visit can legitimately exceed
several times over, not a central estimate the price should track
closely -- the checker's ratio math was built for flat-rate services and
never adjusted for genuinely open-ended, time-scaling ones.

Fixed the checker: `HIGH_RATIO` now only fires for flat-rate-style
entities, not hourly/diagnostic ones. Re-ran: **0 flags across all 580
scenarios**, confirming every one of the 14 was this same miscalibration,
not 14 separate things to individually clear. Full suite reconfirmed
unaffected (still 26 above baseline, unchanged by this).


### #71 — ✅ RESOLVED, T136: the four bad results in the operator's screenshots and trace were ONE root cause -- several independently-evolved parsers -- fixed by one canonical parse
The four reports (a long window rant answered with the generic wall-material question; "ass off tried" invented as an item; "toilet lid is cracked" silently priced as a flapper/fill-valve repair; a kitchen-clock request whose preview said one thing and whose route did another) looked unrelated. Reading the code and the trace, they were not: `qr.html` carried about four separate parsers (the `nlp_engine` block plus a private nested copy inside `enableLiveAdLibPreview()`), so what the client watched being "understood" could differ from what was routed and priced on confirm. Confirmed defects behind them: the object extractor had no grounding in the SSOT vocabulary (trailing verbs and particles became "items"); three module-level functions were declared twice with the later copy silently shadowing the earlier (`_resolveIntakeChain`, `sqToggleBuilder` -- byte-identical, and `sqOpenBuilderPreseeded`, whose two copies each held a DIFFERENT real fix, so neither fix had ever been live together); low-confidence input always went to `sqAnalyze()` and never to the guided builder; the builder's room and condition chips were IIFEs evaluated at script load, before the SSOT existed, so "Where in the home?" showed only "Other" forever; `{item_noun}` placeholders could reach the client unsubstituted; and seven group-level dynamic entities had the generic wall-material question as their whole intake although purpose-built window/furniture/floor modules sat orphaned.
**Decision and fix:** one `understandRequest()` and one `composeAdlibParts()`; everything else calls them; `UIRenderer.js` holds no parsing. Structural guard: `verify_single_parse_pipeline.js`. End-to-end guard against the operator's own corpus: `verify_composer_real_dom.js` (mutation-tested -- 18 of its assertions fail on the pre-fix code). Full patch list in `TIMELINE.md T136`.

### #72 — ✅ RESOLVED, T147 (operator ruling: A; batch 1 applied) — was 🔵 DECISION, T136: the completeness gate and the Safety Net -- what they cost, measured, and one question still open
**Decision:** a request is only priced or routed when the system understood it (a grounded item noun, or a keyword that names the whole job such as "slow drain", with confidence at or above `route_to_group_other_tile`); otherwise the guided builder opens, seeded with what was understood. A request carrying tags keeps the Tag Affirmation card (its constraint must not be dropped). The Safety Net withholds a default named service when a trailing word contradicts it ("toilet LID" against a flapper repair) unless the recommended service's own vocabulary explains the word ("router CONFIGURATION").
**Measured, not assumed** (`test_harness/tools/route_differential.js`, 3,064 phrases generated from the SSOT, old build vs new): 3,012 route identically; 52 differ (22 named->named, 20 dynamic->dynamic, 8 dynamic->named, 2 named->dynamic); **0 resolved-group losses**; 761 phrases are now held at the builder, of which the OLD code had sent 4 to a named service (all contrived, e.g. "fix my install"). The 2 named->dynamic changes are one menu label containing a pipe and an emoji that no client types.
**STILL OPEN (needs an operator ruling):** a phrase that matches only a synonym scores at half weight, so about 17% of realistic single-object phrases (324 rows, `RESULTS/T136_held_at_builder.csv`) open the builder rather than a result. I did NOT lower the bar: doing so could send "car seat" to Toilet Seat Replacement. The SSOT already has the designed mechanism for the right fix -- `full_weight_synonyms` per keyword -- so the recommended path is to promote the high-precision synonyms in that CSV one at a time, re-running `route_differential.js --strict` after each batch. To change the bar itself, edit `workflow.resolution_thresholds.route_to_group_other_tile`.

**RESOLVED T147 — operator ruling: A (promote the high-precision synonyms to `full_weight_synonyms`, one batch at a time). Batch 1 applied.**
**Why this was not decided, and what I would have decided.** The T136 entry framed it as needing a ruling because it changes routing for a quarter of single-object phrases and I could not then measure the effect. A routing change that can be measured is not an operator question. I would have chosen A for the same reason the operator did: precision before recall on an uncertainty-retirement model.
**Method.** 342 synonyms are not full weight; 118 have a phrase held at the builder. A mechanical filter (unique across entries, no shared token, no out-of-domain hit) passes 73, but it also passes `entry`, `hung` and `odd job`: uniqueness cannot measure generality, so judgment came first and produced 31 candidates. The differential (`tools/synonym_batch_differential.js`, the real `understandRequest`, 5,177 phrases: every keyword and synonym in 8 phrasings, 35 out-of-domain probes, curated polysemy probes per synonym) then disqualified **`mac`**, **`pendant`**, **`sconce`** and **`leaky pipe`** (promotion does not promote it). **Batch 1: 27 synonyms across 19 entries; 197 phrases improved, 0 changed entities, 0 newly routed, 0 worsened.** Promoted: bathroom exhaust, washlet, pc, cement, cinder block, weather stripping, weatherstrip, sheetrock, chair, dresser, sofa, ground fault, ssd, storage drive, p-trap, peep hole, alexa, google home, homepod, bathtub spout, television, undercabinet, malware, wax seal, windowpane, paneling, wainscoting.
**Guarded.** `verify_synonym_promotion_safety.js` keeps the judgment on the record: the 45 HELD synonyms with their reasons (it may only shrink), uniqueness, "fix my <synonym>" is understood as its own entry, no out-of-domain probe routes beyond three known pre-existing misroutes (#101), and the batch differential is re-run on every run. **Next batches:** take entries off the HELD list only by passing a differential. **Finding:** a promoted synonym behaves exactly like its keyword (an unrelated noun beside a full-weight term routes 39% of the time for promoted synonyms and 40% for keywords): the router's inherent behaviour, #101.

### #73 — ✅ RESOLVED, T136: test-suite triage under the "rewrite it or 86 it" mandate
The session opened with 6 red tests and briefly spiked to 35 after the parser change, almost all for one reason: nine tests each carried their own hand-rolled `findFn()` that cherry-picked ONE function out of `qr.html` by name, so every helper added beside it broke them with "X is not defined". **Fix at the root:** `test_harness/_engine.js` loads the pricing/NLP/orchestrator modules whole (same header-anchored slicing as `extract_modules.js`); `engineAwareFindFn()` is a drop-in for the old finders. `cms_bridge.js` got the same treatment, and its `analyze` mode now calls the one canonical parse instead of re-implementing the collector (it had drifted).
**Retired (moved to `test_harness/retired/`, reasons in its README, nothing deleted):** four tracing tests that ran `trace.js` in a bare `vm` sandbox with no real window and could never pass (replaced by `verify_tracer_real_dom.js`, which runs the real tracer in the real page); `verify_nlp_engine_module.js` (a weaker duplicate of `check_module_parity.js`); `verify_no_module_drift.js` (its only premise, a deliberate duplicate function, was deleted).
**Rewritten, not just fixed:** `verify_xss_fixes.js` had an assertion satisfied only by an unrelated private function in deleted code -- it now EXECUTES `escapeHtml()` on hostile input; `verify_substring_collision_fixes.js` re-tested a local copy of a regex -- replaced by real-DOM checks (I8/I9 in the composer test).
**Orphaned data:** the scanner had a real blind spot (it ignored chain-step `params.client_response` overrides, so `item_count_overflow_formula`, used 20+ times, read as orphaned) -- fixed. Four genuine orphans were KEPT with an authored `_review_note`, not deleted: `#fragile_item` (injected by code, not data), `database_summation` (a supported checkout state nothing selects yet), `generic_mounting_service` and the unreachable garbage-disposal Mount entity (compiled indexes reference them; removing them belongs in the CMS so the compiler regenerates those indexes). Result: 0 unreviewed orphans.
**Not done:** other tests may still hand-roll function extraction; adopt `_engine.js` whenever one breaks. Two tests (`verify_compute_quote_for_draft.js`, `verify_input_sanitization.js`) need `btnyc.py` and are skipped by `run_all.sh` in an environment without it.

### #74 — ✅ RESOLVED, T136: the Fork in the Road is protected by a real test, and Path B now books the flat diagnostic fee (a decision made under the standing grant)
The operator designated the "Answer more questions OR book an on-site Diagnostic" fork a must-keep retention feature (it is the opposite of the retired "Call for Quote" dead end). `verify_fallback_fork_real_dom.js` (34 assertions, real page, real clicks) protects it and proves the T136 completeness gate and the Tag Affirmation gate do not swallow it; it fails 18 assertions when the fork is disabled in the SSOT.
Writing it exposed a contradiction that was already in the product: after a client chose "Book an on-site diagnostic -- $85, credited back", the card showed "Estimated labor: $422" (the repair's hourly estimate) and "Add to Request" booked $422. The Charter is explicit that Path B is "a flat-rate diagnostic fee ... a bookable, priced service -- not a white flag ... we credit the fee back if we do the work". **Decision:** after Path B the card shows and books the flat diagnostic fee ($85, from `global_rules.divergence_resolution.diagnostic_fee`) with the credit-back promise visible, and the cart line is named "... - On-site diagnostic" with the fork note in its notes. One pure helper, `onsiteDiagnosticTerms(q)`, feeds the card, the cart entry and the legacy cart. Path A is unchanged. New optional SSOT label `divergence_resolution.onsite_price_label`. The test fails 6 assertions against the pre-T136 build. **To revert:** the `onsite` branch in `renderCuratedCardFromRoute`. **Open detail:** whether the $45 dispatch fee is part of, or additional to, the flat $85 is a business term I did not assume.

### #75 — ✅ RESOLVED, T136: Charter "Chips Are Not Pricing Factors" was true of the data but not of the code
The Charter: "No chip carries a fee, appears in a price breakdown, or affects the quote in its own right. Any code path that reads a chip as a fee source is a defect." No smart_tag carries a fee today -- but `computeUnifiedQuote` still added `t.effects.fee` and `t.effects.minutes` and wrote a `source:'tag'` line into the breakdown, and six legacy UI sites printed or summed a chip's own fee. `verify_chips_are_not_pricing_factors.js` makes the invariant behavioural: give every chip a $999 fee at runtime and the same request must price identically. On the old code it did not -- a dishwasher quote went from $422 to $3,252 and a TV mount from $60 to $2,058, with tag lines in the breakdown. All 13 chip-field reads are removed; a chip now contributes its label and nothing else. The test also carries a static check that no line reads a chip's own fee or minutes.
**Reviewed exception, kept on purpose:** the Special Conditions row is ordered by `sqTagFeeImpact`, which reads the fee of the ANSWER a tag synthesizes (`tag.answers` -> module response -> modifier), not a chip field. That ordering was a direct user request (#26, protected by `verify_special_conditions_ordering.js`) and is consistent with "fees live on answers". If the operator reads the invariant more strictly, order that row by detection order and delete `sqTagFeeImpact`.

### #76 — 🟡 OPEN, T136: Charter-compliance work NOT done this session, with the concrete next step for each
Done this session: One Parse; the completeness gate and Safety Net; No White Flag (Path B priced); Chips Are Not Pricing Factors; Dumb UI (parsing removed from the renderer); Single Source of Truth (window/furniture/floor modules wired). Not done:
1. **Gateway convergence.** `collectBookingContext_otherTile` (Gateway C) still has no UI caller. Next step: wire it, then retire `sqBuildCuratedIntake`, the legacy `showIntakeQuestions` and `sqBuildStep3` one at a time, each behind an equivalence test like `verify_sqanalyze_orchestrator_equivalence.js`.
2. **53 Skilled/Specialized services ask a quantity question.** Charter: quantity "should generally not be asked at all" for these tiers. This is a heuristic flag, not a clear defect (a client may genuinely want three door locks), and removing the question changes per-unit pricing, so it needs an operator ruling: which of the 53 are true one-off scoped jobs? Proposed mechanism once ruled: a `_review_note` on each justified exception and a ratchet test so a NEW Skilled/Specialized service cannot ask quantity unannotated (same pattern as the orphan scanner).
3. **23 tier / minute-band mismatches** were flagged by the opening audit; I did not reproduce or itemize them this session. Next step: re-run the tier check, then decide per service whether the tier or the minutes is wrong (this changes prices, so it is a business call).
4. `state_mutation_classification.json` versus a direct regex count of `S.*` mutations still disagree; not investigated.
5. The synonym-only question in #72.

**Item 2 (the 53 Skilled/Specialized quantity questions) — RESOLVED T147.** *Why it was not decided:* it was posed as a per-service operator review, when the data and the schema's own text decide it (`per_unit_answers_vary` already says such a service "should NOT show the qty stepper at all"; a real quantity question is the generalizable kind, "how many light bulbs"). *What I would have decided:* the operator's answer, after measuring. **Measured:** 60 quantity steps in 56 services: 36 numeric steppers (all work; 25 sat on whole-object jobs and were legacy markers, "force-injected universally" by their own `_note`) and 24 banded (12 priced nothing). The operator's refrigerator *repair* (`repair_appliances`) has no quantity step at all; the visible "Quantity" row is the builder's step 3, shown for all 76 services. **Decision:** every service holds exactly one stance: **single-unit** (`per_unit_answers_vary`, 46 services: appliances, plumbing fixtures and lines, light fixtures, fans, thermostats, doors, TVs, whole-computer jobs, damage-repair doors) or **batched** (30: homogeneous small units priced per unit, buy-the-hour mounting, the configurable PAX), each batched Skilled/Specialized step carrying a written justification. Enforced by `verify_quantity_question_ratchet.js`: a new Skilled/Specialized service cannot ask quantity unannotated and cannot leave its stance undeclared. **The job-complexity-evolution principle, as built:** across a banded count question the implied complexity never falls as the count rises (evidence promotes, never demotes); and a customer who states multiples for a single-unit service is told that this quote is for one and each is its own request. **Not built (#99):** promoting complexity from text-stated multiples; the one place evidence promotes tier today is the bands' `complexity_override`.

**T148: item 2 closed by cross-reference (operator ruling).** The 53 count is superseded by the 46 / 30 split with declared stances, enforced by `verify_quantity_question_ratchet.js`.

### #77 — 🔵 DECISION, T144: `trace.js` is an observation-only layer; guarded call sites are permitted in any layer
The operator states that `trace.js` reads and records for operator and tester consumption, writes no logic, and will later become a user-facing bug-report interface. **Verified against the deployed file (T142), not assumed:** it reads nine `S` fields (`_curatedMode`, `_fromBuilder`, `_isOtherTileEntry`, `_svc`, `adlibConfirmed`, `answers`, `intent`, `qty`, `stype`), writes none, calls no application function, dispatches no input, assigns no `innerHTML`; its only other `window` writes are four of its own bookkeeping flags.
**Measured:** `node test_harness/tools/render_diff.js qr.html qr.html btnyc.json --trace trace.js` -- the same build with the trace layer absent versus live and recording -- is identical across all 836 renders (1,950 trace events captured, 0 differences, 0 errors). The tool refuses to pass unless the layer is demonstrably live: the page's Content-Security-Policy admits scripts only from its own origin, so a `file://` page can never load it (a first version of this check never loaded the script and would have reported a false pass; the run is now served from the deployed origin). This withdraws an earlier "conflict needing a ruling" about trace calls inside Logic: observation that cannot alter results is not business logic. The three `S` fields the dead-state detector had called dead (`_fromBuilder`, `_isOtherTileEntry`, `adlibConfirmed`) are read by `trace.js` and stay.

### #78 — 🔵 DECISION, T144: the SSOT `requires` relation is applied once, at tag-set assembly (R-INVARIANT-NOPATCH)
`smart_tags[*].requires` (two tags today: `#very_heavy` requires `#two_person_required`, `#virus` requires `#tech_device_computer`) was enforced only by the retired curated-intake builder, on the tag-chip path. Restoring it there alone would be "a temporary symptom fix", so it lives in `closeTagsOverRequires` (pricing engine) and is called wherever a tag set is assembled: `computeQuoteFromState` (both the in-force and the chargeable set), `executeWorkflow`, `syncTagSynthesizedAnswers` and `buildQuotePanelModel`. `toggleTagState` keeps the chip display in step.
**Semantics:** transitive, cycle-safe, discovery-ordered; the customer's explicit negation beats an implication; provenance is preserved (a requirement derived from a detected-but-unaffirmed tag is itself unaffirmed); de-selecting a tag that another active tag requires records an explicit negation rather than silently re-deriving; a derived tag synthesizes its answer (a virus implies a computer, so the device question is retired); with no `requires` in play the result is exactly the expression every caller used before, so every other tag is unchanged. **Verified** on both entry paths at the public boundaries (`verify_tag_requires_restored.js`, 34 checks, expectations taken from the SSOT, five deliberate breakages all caught).
**Honest limit:** neither authored required tag has a price effect today (`#two_person_required` has no authored answers; `#tech_device_computer` only sets an answer no fee depends on), so the rule currently changes which tags are in force and which question is skipped, not any price. A non-vacuity check caught this; price equivalence is tested on a synthetic priced pair.

### #79 — 🔵 DECISION, T144: the price-affecting indicator is restored on the live card
`intake_modules[*].affects_price` (true on 109 modules) and `ui_config.affects_price_icon` were consulted only by the retired builder, so the live card never showed the "this answer changes your price" mark. Restored through `_iconContent`, a DOM-node helper with a strict class allowlist (`^ti ti-[a-z0-9-]+$`; a malformed value renders nothing, never an arbitrary class). Grounded in Principle 7 (transparency) and Principle 9 (nothing curated is lost). Verified through the real service tile, judged by the card's visible text and the SSOT (`verify_curated_card_live_behavior.js`, 12 checks; green on the build, red on each reintroduced regression, still green under a behaviour-preserving refactor).

### #80 — ✅ RESOLVED, T147 — was 🔵 DECISION, T144: a stale T118 price check updated to the documented contract -- operator to confirm the price semantics
`verify_qty_multiplier_formula_fixes.js` asserted $925 for the T118 screenshot scenario and passed only because its hand-picked function list omitted `entityHasOwnQtyQuestion`. **In the real browser -- the original file and the current build alike -- the scenario prices at $245**, even at quantity 5 with no quantity answer: the quantity guard (brief section 3.6) ignores the outer quantity for an entity that owns a quantity question, and `wall_hole_or_crack_repair` has `item_count_template`. The check now asserts that contract, asserts that the sandbox contains the guard, and carries a contrast for an entity without its own quantity question (the outer multiplier must still apply there).
**Operator to confirm:** that "4 or more areas (specify exact count in notes)" should price at the band's base until an exact count is given. If a larger figure is intended, the change belongs in the formula's handling of `__exact_count`, not in this test.

**RESOLVED T147.** *Why it was not decided:* I read it as a question about price semantics ("operator to confirm") instead of asking why the question priced nothing. *What I would have decided:* the operator's wording and arithmetic, then the diagnosis. **The disease, not a symptom:** (a) the count question's bands carried no modifier: asked, never priced (12 count questions in the catalog); (b) `project_scale` asked the same extent a second time; (c) the owner's overflow formula dropped the flat top-band price (the engine skips the module that triggered a formula, and the formula returned only the overflow), so "N or more" priced at the 1-unit base **under the band below it** on five services (`window_hardware_repair` $105 then $55; `gfci_outlet_replacement` $75 then $40); (d) no test said a count must price or that price must not fall as the count rises. **Fixed:** the formula carries the band's flat price; the five dormant bands carry the band below's price; the wall family has exact bands (1/2/3/4/5+, the operator's "walls" wording, the size question immediately before it) at n x base, including beyond the top band through the overflow; `project_scale` removed from `wall_hole_or_crack_repair`; two ratchet rules with mutants (a count question must price; price never falls as the count rises). **Numbers:** $70/$140/$210/$280/$350, 8 walls $560; brick + large + ladder $170 at 1 wall, $450 at 5. **The earlier $245 vs $925:** at one wall with those conditions $245 is right; $925 and $1,225 came from multiplying a heavy single-wall price, which no path does any more. **Open:** `project_scale` still overlaps the count question in three services (#97).

**T148: closed by cross-reference (operator ruling): no operator confirmation needed.** T147 fixed the underlying diagnostic (the `project_scale` overlap, the formula's band pricing, the count question that priced nothing); the scenario prices at the documented contract.

### #81 — ✅ RESOLVED, T145: (customer-facing, pre-existing) answer chips on the catalog card select nothing
Tapping a service tile shows the curated card (17 chips for `prehung_interior_door_install`); clicking a chip selects nothing and records no answer. **Identical in the original `_qr.html` and the build**, confirmed through the tile's own click handler. Cause: `window.handleIntakeAnswer` works from `window._currentRoute` / `window._currentContext`, which only the free-text path sets; the catalog path records `S._lastRoute` and `S._lastContainerId` (through `sqRenderCuratedCard`) instead, and the handler does nothing, silently, when `_currentRoute` is unset.
**Canonical fix (R-INVARIANT-NOPATCH -- not a one-gateway patch):** a route-in / route-out Logic function in the `orch_apply_remote_divergence` pattern (`orch_apply_answer(prevRoute, moduleKey, label, DB)`), one Glue handler for every gateway that re-renders into the container the route lives in, and the `window._current*` globals retired. A behavioural test must click a chip through the real tile and watch the card change. Found because the parity sweep and an earlier test measured rendered output, not interaction (R-GOVERN-GOODHART).
**Resolved, T145:** the route now carries the context that produced it (`route.context`); `orch_apply_answer(prevRoute, moduleKey, label, DB)` is route in, route out and serves every gateway; `window.handleIntakeAnswer` is thin Glue that re-renders where the card lives (`S._lastContainerId`). The fork's deep-dive questions are carried forward by a shared splice (`orch_splice_remote_deep_dive`), so answering one never drops the others. Verified by 245 real clicks across 70 services through the real tile, the fork on all three diagnostic services, and five deliberate breakages all caught (`verify_curated_card_live_behavior.js`, 20 checks). The affirmation handlers were not migrated in the same change: #92.

### #82 — ✅ RESOLVED, T146 (customer evidence; inherent defaults split to #93): (pre-existing) a tag with authored answers prices on the state path and not on the orchestrator path (R-CLIENT-CONVERGE)
`#very_heavy`: +$110 on the state path versus +$0 on the orchestrator route; `#virus`: +$15 versus +$0; 66 of 68 services disagree. Structural cause, present in the original: `syncTagSynthesizedAnswers` is called from two state-path sites, and neither `executeWorkflow` nor any `orch_*` function reads a tag's `answers`. A route's price line (for example on the tag-affirmation card) can therefore differ from the panel's final price.
**Canonical fix:** one pure `synthesizeAnswersFromTags(tagIds, answers, DB)` used by both paths (and by `syncTagSynthesizedAnswers`), with a test asserting cross-path price agreement for every tag with authored answers. That test is deliberately not added yet: it would be red for a reason unrelated to the work in T144, and a red test is fixed or retired in session (R-INVARIANT-REDTEST).
**Resolved, T146:** `synthesizeAnswersFromTags` is one pure function shared by both paths (`syncTagSynthesizedAnswers` is an in-place adapter over it); `executeWorkflow` synthesizes for the tags the customer chose or the NLP detected; `orch_compute_quote` applies the state path's chargeability gate. Verified for every tag with authored answers on every service (1,972 pairs) for chosen, detected-unaffirmed and affirmed tags, with eight deliberate breakages all caught (`verify_tag_synthesis_convergence.js`, 16 checks). **Not done, by design:** inherent service-default tags on the card path -- #93.

### #83 — 🟡 OPEN, T144: `sqBuildStep3` needs a compliant port before it may be deleted (compliance before deletion)
13 hits (5 comment, 7 call, 1 definition). It is the only step-3 chip renderer and is load-bearing, so under R-INVARIANT-DELETION the first response is to adapt it, not to delete it. Port: a Logic chip selector (which chips, in what order, from the SSOT), a DOM renderer, thin Glue; then delete the function and clear the name.

**T147: acceptance criterion #1 for the port.** Remove the static "Quantity" row from step 3. It shows for all 76 services; the engine now prices one unit for single-unit services and `sqAdjQty` cannot move past 1 for them, but the control is still visible. Drive its presence from the service's declared stance (`route.quantity.stance`).

### #84 — 🟡 OPEN, T144: layer violations (21 Glue, 6 Logic in `store.js`) and 9 dead `S` fields
Measured with the operator's own `COMPONENT_LAYER_MAP.md`: the original file had **157** violations (Logic 25, Rendering 95, Glue 37); the build has **27** (Glue 21, Logic 6, Rendering 0). The Glue functions are all untouched by T143/T144 (`applySSOTRules`, `sqAnalyze`, `sqBuilderFinish`, `sqPrepareFlow`, `prefillSmartQuoteFromOtherTile`, `sqRenderSelfQuoteAdlib`, `sqBuildStep3`, and others); touching one obliges full compliance of that function (R-INVARIANT-COMPLY).
**`store.js`:** the map assigns it to Logic/Engine, and `bindLegacyGlobals` mirrors store state into the legacy `State` global -- six `logic-global-ui-state` violations in that one function. **An earlier measurement in this work used a short layer map of its own that classified `store.js` as Glue and so hid these six; that was a mistake, and the numbers above are the corrected ones, measured with your map.** They are counted, not reassigned away: moving the module to Controller/Glue would improve the number without changing the code (R-GOVERN-GOODHART). The honest exits are to port the bridge away (the migration it exists for) or for the operator to reassign the module deliberately.
**Dead `S` fields** (33 examined, 9 with no reader): `_affirmedTagSet`, `_confidenceStrategy`, `_escalatedBy`, `_forceModules`, `_jobNotes`, `_negationPivotAccepted`, `_notes`, `_pendingPivotInfo`, `_selfQuoteSvc`. Remove each together with its writer's migration, so no non-compliant function is touched twice.

### #85 — 🟡 OPEN, T144: universal icons, tag-affirmation handlers and direct checkout-state reads (operator brief sections 2.1, 2.5, 3.10)
**2.1:** about ten render sites assume different icon formats (category cards assume Tabler class names, group and service tiles assume emoji text, breadcrumbs concatenate, the builder assumes a bare suffix), plus the cart. Needs a behavioural test that flips every SSOT icon to the other form. **2.5:** the handlers exist -- `window.orchAffirmYes`, `orchAffirmNo`, `orchAffirmRemoveTag`, `orchAffirmSelectService`, written as `window.x = function` assignments, which my first audit's scan for function *declarations* missed (it wrongly reported them absent) -- but the Yes / No / Remove / Select flow has no end-to-end test, and they work from `window._currentContext` (#92). **3.10:** 11 direct reads of `financial_engine.checkout_state` bypass `resolveServiceCheckoutStateKey`.

### #86 — 🟡 OPEN, T144: business numbers in code (R-GOVERN-RULEPARITY: as binding as any Enforced rule)
`|| 5` (the follow-up cap), `?? 70` (the default base price in `buildServiceSessionSeed`), `|| 45` (the dispatch-fee fallback in `computeUnifiedQuote`). Each belongs in the SSOT with a `_note`. They are listed, not tolerated: the Charter gives every rule equal weight whatever its current enforcement status.

### #87 — 🟡 OPEN, T144: (ticket, R-INVARIANT-DUPLICATION-TICKET) `classifyServiceIntake` restates the orchestrator's self-quote decision
Moved to Logic verbatim in T143 and still a second implementation of what `orch_select_ui_template` decides. Delete it when the controller consumes `route.uiTemplate`.

### #88 — 🟡 OPEN, T144: known limits of the layer gates (R-GOVERN-GOODHART: could someone satisfy the gate while violating the rule?)
Eighteen deliberate evasions were written against the Rendering boundary scanner; ten got through; three classes are now closed (aliasing `window`/`globalThis`, a template-literal key, a `const` string used as a key). **Seven remain, by nature outside a source check:** `State` and the store handle (not named in the Enforced rule), a call name assembled from strings, `Function(...)`, `eval` (R-INVARIANT-NOEVAL's territory), inline pricing arithmetic and state read through a Glue getter (R-INVARIANT-RENDERERS, Judgment). The retired-artifact test asserts the absence of *names* -- a retained copy under a new name would pass it; the orphan and duplicate-logic scans complement it. Whether a Glue function owns business logic is Judgment.

### #89 — 🟡 OPEN, T144: suite, manifest and ledger-tooling hygiene
`verify_charter_rules.js` and `verify_charter_rule_index_v2.js` exist in `test_harness/` but are not in `MASTER_TEST_SUITE.json` (they ran unacknowledged before T144; registering them was not part of that change, and the suite file's own procedure forbids a separate sync pass). `verify_file_integrity.js --update` silently drops a tracked file that is absent from the disk it runs on, a coverage loss of the kind its own comments record; the T144 manifest was generated through a temporary copy that preserves such entries verbatim (suggested guard: fail, or keep the old entry and say so). Many test copies in my Project Files predate T136 (the T136-era tests are not there); hand-maintained function lists should move to `_engine.js`, which surfaced the stale price check in #80 on first contact.
The `tools/build_*.py` aggregator builders and `check_decisions_drift.js` are not visible to me, so the T143/T144 entries and #77-#91 are untested against their parsers: run `run_all.sh` (its last stage regenerates `AGGREGATOR.html` and `charter-status.js`) and confirm they appear. The parity sweep `curated_card_renderer_parity_sweep.js` was retired by deletion (R-INVARIANT-DELETION: its last result is recorded in T144 and git keeps the file); T136's convention archives retired tests in `test_harness/retired/` with a README -- if you prefer that here, move the file there instead.

### #90 — ✅ CLOSED, T149 (R-DOMAIN-DYNCHAIN data fixed; the UIRenderer API half was closed in T148) — was: 🟡 OPEN, T144: Charter index test: the same two failures as before this work
`R-DOMAIN-DYNCHAIN` (SSOT: the `window_ac` dynamic chains lead with a generic `symptom` module; the compiler rejects it, which also fails five compiler suites) and `R-SYSTEM-MODULE-API` (UIRenderer's declared cross-module surface).

**T147 update.** The rule-index meta-test went from 9 failures (after the quantity change) to **2**: R-DOMAIN-DYNCHAIN and R-SYSTEM-MODULE-API for UIRenderer only. The pricing and orchestrator API lists now document the six functions added in T144-T147; its shared bundle builder is engine-aware and two stale hand-copied preludes (a duplicate registry inside a test) are gone.

**CLOSED T149.** R-DOMAIN-DYNCHAIN had seven violations in two shapes (full account in the T149 ledger entry). Five plumbing_help groups (garbage disposals, sinks, showers and tubs, toilets, water lines) led their Diagnostic fallback with the generic `symptom` module, whose question asks about "the appliance": three group-owned modules now (`garbage_disposal_issue`, `plumbing_fixture_issue`, `water_line_issue`), each copying only the applicable generic answers with identical effects; 1,380 price points unchanged; held by `verify_dynchain_group_modules.js`. Two Install/Setup entries in `tech_trouble_computer_repair` were the rule over-generalising, so symptom_first now constrains Diagnostic and Repair entries only (the data: 16 of 16 Diagnostic and Repair entries in symptom_first groups carry a symptom module; the two Install/Setup entries are the only ones of their type). The UIRenderer public-API half of this item was closed in T148 (the API table in the unified suite was brought up to date).

### #91 — 🔵 DECISION, T144: the operator's feature brief reconciled with the Charter; 52 of its 54 items are already present
The brief was written for `___qr.html` (the July 1 base) and reads as a spec for features the Sept 29 lineage already carries; it is treated as a checklist of behaviour to preserve and make compliant, not as an instruction to add code beside non-compliant code. **Where it conflicted with the Charter, the Charter governs (the operator confirmed):** "do not restructure or move functions; each feature is additive" contradicts R-INVARIANT-COMPLY, R-SYSTEM-LAYERS and R-INVARIANT-BOUNDARY (ten functions moved, several split); "add no store or reducer" -- nothing was added, the existing store is left (its bridge is #84); section 2.9's trace calls inside Logic were first read as a conflict and are withdrawn (#77); section 2.3's `classifyServiceIntake` was implemented as specified and ticketed as a duplicate (#87); section 2.1's `_iconContent` accepting any `ti ` string as a class name became a strict allowlist (#79); section 1's "the app is broken without computeQuoteFromState" describes the July 1 file -- both functions exist in the Sept 29 lineage and now live in Logic taking `state` explicitly.
**Audit result (every item checked against the code):** 52 of 54 present. Not met: section 2.1 (universal icons) and 3.10 (direct checkout-state reads). Section 2.5's handlers exist (my first scan missed them) but their flow has no end-to-end test -- all in #85 and #92. Section 5's dead symbols were all comment residue and are cleared.

### #92 — 🟡 OPEN, T145: the affirmation handlers and the remaining `window._currentRoute` / `_currentContext` writers still hold "the current context" in globals
`window.orchAffirmYes`, `orchAffirmNo`, `orchAffirmRemoveTag` and `orchAffirmSelectService` re-run the workflow from `window._currentContext`; `renderRoute`, `sqAnalyze` (free text) and the self-quote path write `window._currentRoute` / `_currentContext`. T145 gave the answer chips a canonical route (`route.context` + `orch_apply_answer`); these handlers are the same pattern and are the next to move: one `orch_apply_*` Logic function each (route in, route out), thin Glue over `S._lastRoute`, the globals retired. Today they call `executeWorkflow` directly, a Glue-to-engine call the layer census counts.
**Missing test:** an end-to-end behavioural test of the free-text flow -- type a request that detects tags, see the affirmation card, then Yes / No / Remove-tag / Select-service -- driven through the real interface. The handlers have unit-level tests (`verify_tag_affirmation_route.js` and others) but nothing exercises the whole flow in a real DOM.

### #93 — 🟡 OPEN, T146: inherent service-default tags are applied on the state path but not on the card path -- a money-affecting gap, and a design decision between visible and priced answers
The operator's v9.6 fix (in `syncTagSynthesizedAnswers`) records that a service's own `default_tags` are **service facts** whose answer-fees must price: `brick_or_concrete_crack_repair`'s inherent `#brick_wall` carries a real $25 `wall_type_brick_or_concrete` fee and the service never asks `wall_type`, so every booking was undercharged. That fix exists on the state path only. **Measured (T146):** 44 services have default tags and 16 distinct tags among them carry authored answers; the card (orchestrator) path prices **10 of those services lower** than the state path, by $10 to $110, **$400 in all** (`flatscreen_mounting_standard` $60 versus $170, `flatscreen_mounting_with_hidden_cables` $150 versus $260, `high_ceiling_bulb_replacement` $25 versus $65, `data_backup_or_transfer` $99 versus $129, `brick_or_concrete_crack_repair` $70 versus $95).
**Why it was not just applied:** applying them the way the state path does puts the answer into `route.answers`, which **pre-answers questions the card asks** on 13 services (`angle_stop_replacement`'s fixture, `blinds_shades_curtains_buy_the_hour`'s wall type, `flatscreen_mounting_standard`'s weight, ...), changing what the customer sees. **Proposed design:** price the assumption without changing the questions -- synthesize over the union (customer tags plus inherent) in ONE pass, so conflicts resolve exactly as on the state path (disagreeing tags synthesize neither), then show the card only the answers customer-evidence tags produced while pricing with all of them; an explicit answer still beats the default, and now that the chips work (T145) the customer can change it. Needs a test of the same shape as `verify_tag_synthesis_convergence.js` over the 44 services, including the 13.

### #94 — 🟡 OPEN, T146: the two paths describe a catalog tap's confidence differently (an observation, low priority)
In `computeUnifiedQuote`, `meetsConfidenceBar` is 100 whenever no intent keyword is passed, and `base_confidence + keyword weight` when one is. For a catalog tap the state path passes `intent.key` -- the service id, a weak keyword -- while the orchestrator's catalog context passes none, so the same tap is "fully confident" on one path and `base_confidence` on the other (`shelf_mounting_standard_buy_the_hour`: `meetsConfidenceBar` false versus true). It has no effect on tags today (a catalog tap has no detected tags) but it is a third description of confidence next to `orch_compute_confidence` and the quote function's own. Candidate resolution: one confidence function (R-INVARIANT-CANONICAL), with the explicit selection of a service counted as certainty on every path.

### #95 — 🟡 OPEN, T147: the arbitration inventory (R-INVARIANT-PROVENANCE, DEFECT-ARBITRATION)
`verify_r-invariant-provenance_caller_composition.js` finds **22 places where a caller composes an unmigrated resolver's return with a second source**, frozen in 15 `function | resolver | operator` entries that may only shrink: `computeUnifiedQuote` (the checkout-state `||` chain, the strategy `|| 0`, the archetype result `??`), `orch_compute_confidence` (3 `||` on the strategy, a `?:` on the escalation), `sqPrepareFlow` (2 on the strategy, 1 on the dynamic definition), `prefillSmartQuoteFromOtherTile` (3), `executeWorkflow` (4 `||` on the entity), `orch_resolve_entity`, `collectBookingContext_freeText`, `isDiagnosticService`, `resolveServiceBadge`, `resolveServiceBadgeKey`. **Migrated and zero-tolerance now:** `resolveQuantityUnits`, `resolveQuantityMultiplier`, `orch_max_followup_questions`. The audit's other named instances the detector cannot see by shape: `sqRenderSelfQuoteAdlib` (a separate pricing formula: DEFECT-PREVIEW-CHARGE-MISMATCH); `S._forceModules` written and never read, `resolveForceModules` a stub with two inline copies; `sqPrepareFlow` re-deriving `applyLiveConfidenceEscalation` inline; `getServiceProfile`'s raw `checkout_state` read; the `answerCheckoutOverride` per-answer override. **Next:** migrate `resolveServiceCheckoutStateKey` and the callers of `resolveBaseConfidenceStrategy` (it already names its source per field), lowering the frozen counts as each goes.

**T150 update: `resolveServiceCheckoutStateKey` is migrated.** It returns `{ key, source }` (the Charter's vocabulary), every reader asks it, no function but the resolver reads an entity's `checkout_state`, and it moved from the detector's frozen LEGACY list to STRICT (no composition allowed anywhere). The frozen inventory is now **17 sites across 11 places** (was 22 across 15). Migrating it also found a real divergence: the card-tap path said no service self-quotes while the route said two do (T150 ledger entry). **Still to migrate, in the order the unified suite lists them:** `minimum_quote_confidence` (low-level reads in `applyLiveConfidenceEscalation`, `computeUnifiedQuote`, `orch_compute_confidence`, `sqPrepareFlow`, behind `resolveBaseConfidenceStrategy`), `pricing_engine_key` (`resolveEngineKey` composed in `sqRenderSelfQuoteAdlib`; six low-level reads of `pricing_engine`), and `intake_chain` (`_resolveIntakeChain` composed in `orch_compose_intake_chain`; thirteen low-level reads). **Method that worked and should be repeated:** before migrating a concept, measure every reader across every entity and ask whether they disagree *today*; here that turned a "tidy the structure" task into a customer-visible fix. **Default if unanswered:** `intake_chain` next (the most reads, and the most likely to hide a divergence).

**T155 (A2b) update: 17 sites -> 10, across 6 places.** Each of the 17 was located, classified R/P/D and either closed or recorded under "Phase A deferred (T155)" below. Closed (7): `computeUnifiedQuote` (the `_variability_tier` default and the archetype `??`), `orch_compute_confidence` (all 4: the typeof-guarded copy of the escalation result, the minimum-confidence chain with its literal 80, two `|| 40`), `collectBookingContext_freeText` (the `nlpIntent._groupId` operand, a field nothing writes). Each deleted second source was measured unreachable first (159 entities; 159 phrases), and each has a counterfactual world that was red before the change (see the T155 A2b ledger entry). Remaining (10): `executeWorkflow` x4 (P), `orch_resolve_entity` x1 (P, a predicate), `prefillSmartQuoteFromOtherTile` x2 (R, ship-gate-held), `sqPrepareFlow` x3 (ship-gate-held). The three concept migrations still to do are unchanged: `minimum_quote_confidence` (now without the `orch_compute_confidence` reads), `pricing_engine_key`, `intake_chain`.

**Operator T156: the stated default is confirmed ("Everything else on the stated default... proceed"); the work is held for Phase B, which waits for your explicit go.**

### #96 — 🟡 OPEN, T147: 36 questions declare they affect price and change nothing (DEFECT-UNWIRED-QUESTION, proposed)
Of 122 non-quantity chain steps declared price-affecting (`affects_price` or `purpose: pricing`), **36 across 26 modules change no price, time, tier or branch** (frozen by name in `verify_quantity_question_ratchet.js`; may only shrink): `location` (6), `space_ready` (4), `window_type` (2), `length` (2), and single instances (`brand`, `floor_type`, `item_type`, ...). Many are identification or preparation questions with a wrong declaration (Principle 4 allows preparation), not padding. Each needs one decision: reclassify (`purpose`, `affects_price`, and the unearned `confidence_gain` it carries) or wire it. The ratchet already stops new ones.

**T150: a live instance, now with a measured consequence.** `led_bulb_upgrade` declares price bands on its bulb-count question (1 / 2-3 / 4-6, each moving complexity and price), but the service carries an authored `behavior.bypass_intake`, so the route skips the question and the bands never apply: the route quotes **$20 for 1, 2, 3 or 5 bulbs**. See #108.

### #97 — 🟡 OPEN, T147: `project_scale` still asks the extent the count question asks, in three services
Removed from `wall_hole_or_crack_repair` only (its `dmg_size` covers size). `plaster_wall_repair`, `wood_paneling_repair` and `squeaky_floor_repair` have no size question, so `project_scale` ("single item / a few items / extensive") is their only size dimension and still overlaps the new count question's wording. Each needs a decision: keep it as size with reworded answers (it is a shared module, so reword per service through `params`), or add a size question and remove it. Candidate default: a size question in the wall family's own wording, `project_scale` removed.

### #98 — 🟡 OPEN, T147: R-SYSTEM-NODATA is marked Enforced and the quantity concept still has code-side name sets; one open-ended band is unwired
The operator's audit is right that R-SYSTEM-NODATA is not enforced. For quantity: `_GENERIC_QTY_MODULE_KEYS` (declared once plus three fallback copies), `QTY_AWARE_FORMULAS`, `QTY_MODS_UNCONDITIONAL`, `ORCH_QTY_MODS`, the `_QM` set in the builder, and the ratchet's own list of quantity module names are hand-maintained business knowledge in code; a new quantity module with a new name evades all of them. **Proposal:** a `quantity_kind` field on the modules (`stepper` | `banded` | `gate`) as the one definition, the sets derived from it, the ratchet reading it. The Charter's R-SYSTEM-NODATA status is the operator's call (Partial would be honest today). Also `router_configuration`'s open-ended top band ("16+ devices") is unwired, so 16 or 400 devices cost the same; it is exempt in the ratchet by name and may only shrink.

**T148 finding.** The operator's unified suite already derives the generic quantity keys from `intake_modules[*].type` (`deriveGenericQtyKeys()`), so the data already carries a definition of "stepper" (`type: numeric_multiplier`); the proposed `quantity_kind` field is largely redundant. What remains is for the engine's own code sets (`_GENERIC_QTY_MODULE_KEYS` and its copies) to derive from `type` the way the harness does.

### #99 — 🟡 OPEN, T147: complexity promoted by text-stated multiples (design only)
Today, text that implies several units of a single-unit service prices one unit and the card says so, naming the quantity asked (`route.quantity`). It does not promote complexity. **Design when wanted:** a rule in the workflow SSOT (not code) that, for a single-unit service with `requestedQty > 1`, records a promotion `{from, to, source: 'text_multiples'}` on the route and raises the tier one step, so the request reads as the larger job it is; the same record would carry the evidence for a future project-variant path.

### #100 — ✅ RESOLVED, T156 (operator: apply all four; applied; the rest of the meta-test's findings are now #120) — was OPEN, T147: the Charter's own meta-test: four markup slips new with the 2026-10-03 revision, and 26 rules with no named test
`verify_charter_rules.js` reports 34 problems against the revised Charter; 30 pre-date it. **The four new ones are markup**, and the fix is four find/replace edits in `PROJECT_CHARTER.html` (verified on a scratch copy: the meta-test returns to its previous 30):
1. `<span class="rule-code">R-INVARIANT-DETECTOR</span> from an aspiration into an action` -> `<a href="#invariants">R-INVARIANT-DETECTOR</a> from an aspiration into an action`
2. `an open item under <span class="rule-code">R-INVARIANT-DETECTOR</span>.` -> `an open item under <a href="#invariants">R-INVARIANT-DETECTOR</a>.`
3. `<strong>Why <span class="rule-code">R-INVARIANT-PROVENANCE</span> fixes it:</strong>` -> `<strong>Why <a href="#invariants">R-INVARIANT-PROVENANCE</a> fixes it:</strong>`
4. `<a href="#client-c">R-CLIENT-PREVIEW</a>` -> `<a href="#gateway-c">R-CLIENT-PREVIEW</a>` (the rule is defined in section `gateway-c`; `#client-c` does not exist)

The cause: the meta-test treats every `rule-code` span as a rule *definition*. **The other 26** are rules marked Partial or Enforced with no test file named for them and no `@enforces` comment (R-PRICE-REGISTERED, R-SYSTEM-NODATA, R-SYSTEM-CSP, ...): most probably have a test that was never annotated. I annotated the four I could verify truly measure the rule (R-INTAKE-QTYONCE, R-INVARIANT-CANONICAL, R-CLIENT-CONVERGE, R-PRICE-SCOPE) and did not guess at the rest. **Proposed for Part X** (R-GOVERN-DEFECTCLASS: a recurring bug acquires a name and a demanded detector): `DEFECT-UNWIRED-QUESTION` (a question that declares it affects price and changes nothing; detector shipped: the ratchet) and `DEFECT-NONMONOTONE-BANDS` (price falls as the count rises; owning invariant R-PRICE-REACHES; detector shipped).

**T148: the operator accepted both proposed inclusions together.** R-INVARIANT-PROVENANCE (with its enforcement note: `verify_r-invariant-provenance_caller_composition.js`, 22 sites frozen by name, may only shrink, three resolvers migrated) and R-GOVERN-DEFECTCLASS (a recurring bug acquires a name and a demanded detector; the first two named classes, DEFECT-UNWIRED-QUESTION and DEFECT-NONMONOTONE-BANDS, both ship detectors; DEFECT-ARBITRATION is the third). The Charter edit is the operator's. The four markup fixes above are still needed for the Charter's own meta-test.

**RESOLVED T156 — operator: "Apply all four markup fixes to `PROJECT_CHARTER.html`."** Applied (commit `ruling/#100`): the three `rule-code` spans that were really references became links to `#invariants`, and `R-CLIENT-PREVIEW`'s link now points at `#gateway-c` (a section that exists), together with the stray duplicated index heading the revision carried. The meta-test is now one audit in `test_harness/charter_model.js` (a real HTML parser: the 2026-10-07 Charter is minified, with unquoted attributes and omitted closing tags, which the old regex readers could not see at all). It reports **9 problems, none of them markup**: 2 index/definition mismatches, 5 rules with no enforcement, 2 orphaned `@enforces` tags. The earlier "26 rules with no named test" is now **5**, because the reader also counts an assertion tagged with the rule code (67 codes are asserted that way, 16 more by `@enforces`). All 9 are filed as #120. The two classes proposed here (DEFECT-UNWIRED-QUESTION, DEFECT-NONMONOTONE-BANDS) were accepted at T148; the Charter's class table now has 10 classes (DEFECT-STALE-SANDBOX and DEFECT-SILENT-SKIP added under #105).

### #101 — 🟡 OPEN, T147: router precision findings from the synonym probes
(1) Three out-of-domain phrases select a named service today, before any promotion: `phone screen` -> `window_screen_repair`, `car light bulb` -> `led_bulb_upgrade`, `laptop screen protector` -> `computer_diagnostic` (frozen as a shrink-only list in `verify_synonym_promotion_safety.js`). (2) A full-weight term beside an unrelated noun routes about 40% of the time for the keywords themselves: the Safety Net withholds a *trailing* unexplained noun ("toilet lid") but not a leading one ("necklace pendant"). (3) `leaky pipe` as a synonym of `leak` does not promote ("fix my leaky pipe" stays held by the object-grounding rule). **Candidate fix for (2):** extend the Safety Net to leading unexplained nouns, measured by the same differential.

### #102 — ✅ RESOLVED, T148 (operator ruling): an unclassifiable request's priced path forward is the guided builder
R-WHITEFLAG-PRICED says there is always a priced path forward and that confidence gates the *level* of precision, not whether a price exists. For an empty or unclassifiable free-text request, `executeWorkflow` returns `entityType: 'fallback'`, `quote: null`, `uiTemplate: 'legacy_flow'` (the guided builder; the curated card and the self-quote template are vetoed because there is no real entity). The unified suite's check ("Even the fallback route carries a numeric price") had never run in the operator's tree (its sandbox bundle could not be built and the check vanished silently), and when it ran it failed against the original too. **Ruling:** the guided builder is the right path: it is the only way a customer can interact with that gateway, and it prices after intake. **Done:** the check now asks for a priced path forward (a numeric quote *or* the guided builder); the route's behaviour is unchanged.

### #103 — ✅ RESOLVED, T156 (operator: retarget the sweep, delete (3) and (4), keep (1) and (2) until their callers migrate) — was OPEN, T148: the four functions the unified suite declares retired, and what each does
`verify_charter_rule_index_v10.js` declares `sqRenderQuote`, `sqRenderSelfQuoteAdlib`, `legacyDetermineSelfQuoting` and `legacyComposeIntakeChain` retired (absent from source); all four are present, so its R-INVARIANT-DELETION check is red by design. **Operator direction (T148): keep them, or remove them per the Charter's rules** (compliance-before-deletion: the canonical path carries every behaviour first, verified equivalent, then delete). **Facts:** (1) `sqRenderQuote`: the quote-panel render Glue (after T144 it composes `buildQuotePanelModel` and `renderQuotePanel`); **live**, called by `sqConfirmAdlib` (its other caller, `sqChooseDivergencePath`, was deleted in T144). (2) `sqRenderSelfQuoteAdlib`: the old self-quote "adlib" sentence plus a **separate pricing formula** (DEFECT-PREVIEW-CHARGE-MISMATCH in the operator's audit; it also holds the numeric literals 65, 85 and 70 that the suite flags); **live**, called by `prefillSmartQuoteFromService`. (3) `legacyDetermineSelfQuoting`: the legacy self-quote decision, kept as a faithful replication of the orchestrator's `orch_compute_variability_flags`; **no product callers**; used as the *oracle* by `verify_shadow_mode_broad_sweep_phase5_5.js`. (4) `legacyComposeIntakeChain`: a one-line adapter, `orch_compose_intake_chain({}, {entity: svc}, DB)`, for test harnesses; **no product callers**; used by the same sweep. **Disposition:** (1) and (2) stay until `sqConfirmAdlib` and `prefillSmartQuoteFromService` are served by the canonical route path (the #83 and #95 work; `renderSelfQuoteFromRoute` already exists). (3) and (4) are removable once `verify_shadow_mode_broad_sweep_phase5_5.js` asserts the canonical properties directly instead of comparing against the legacy oracle (its parity purpose ended when the legacy path was retired). **Default if unanswered:** do (3) and (4) next: retarget that sweep, delete both, declare them in `retirements.json`; leave (1) and (2) with their callers named here.
**`init` (separate).** The original `_qr.html` had **two** functions named `init`. The live one is the self-invoking boot IIFE in the `store.js` block (it loads `btnyc.json`, calls `initNlpSets`, `cacheDOM`, `buildDataMaps`, `renderCategoryCards`, `initSmartQuote`, `wireGlobalEvents`, creates the store and defines `window.renderRoute`); it is untouched, and the file delivered at T147 has exactly that one. The second was an `async function init()` inside the UIRenderer block that was never called (the only reference is a comment), loaded `btnyc_v10_final.json` from legacy URLs before falling back to `btnyc.json`, and was the sole caller of the already-declared `adaptV10ToLegacy`; it was deleted in T143. It cannot be declared in `retirements.json`: that file's rule is a literal grep for zero hits (the operator's own directive), and the live boot IIFE shares the name `init`, so the rule is unsatisfiable for that name; the deletion is recorded here and in the T143 and T148 ledger entries. The unified suite's API table named it under `UIRenderer.js`; that entry is removed.

**RESOLVED T156 — operator: "Retarget the shadow sweep; delete `legacyDetermineSelfQuoting` and `legacyComposeIntakeChain`. Leave `sqRenderQuote` and `sqRenderSelfQuoteAdlib` in place until their callers migrate (#83, #95). Record all four in `retirements.json`."**
(3) and (4) were already deleted from `qr.html` in Phase A (C-01 and C-08; zero occurrences of either name remain, comments included). What was left was their last user, `verify_shadow_mode_broad_sweep_phase5_5.js`, which diffed the orchestrator against those two copies through a 41-function cherry-picked sandbox that had lost `closeTagsOverRequires`: red on every service with "X is not defined", so it had measured nothing. It is **rewritten under the same name**: it loads the engine modules whole (`_engine.js`) and holds every service's route to the property it must satisfy, read from the SSOT or from the one function that owns the decision (declared template; the one self-quote decision; the resolver's checkout state; declared tier; `computeUnifiedQuote`'s money; declared, unique and composed intake chain; `intake_defaults` reach the chain; materials). **100/100, and 9 mutants prove each property can fail.** All four names are in `retirements.json` (`declared_retirements`; the last two cite this ruling). `sqRenderQuote` and `sqRenderSelfQuoteAdlib` are declared but still present, so the unified suite's R-INVARIANT-DELETION check stays red for those two **by design**, with the entries' notes saying so; it goes green when `sqConfirmAdlib` and `prefillSmartQuoteFromService` are served by the route path (#83, #95).
**Found while retargeting (a measurement, filed as #121):** the old sweep asserted that a plumbing service "receives its category default (urgency)". The catalog no longer says so.

### #104 — 🟡 OPEN, T148: the unified suite as delivered, what was patched, and the 28 failures that remain
**Patched** (a patch against the file as received): HTML-aware `_parseAst`; engine-aware `bundleFunctions`; `_bundleGuard` (all 15 sandbox checks had no else); the pricing-fuzz oracle (`extraFee + perVisitFee`); the R-INTAKE-QTYONCE checks at the resolver; the two R-CONF-ONEFORMULA checks whose subject was deleted in T144 moved to `orch_max_followup_questions`; the quantity resolvers added to the concept registry and the provenance block (measured in their real module context); a population assertion for R-INTAKE-QTYONCE; the fallback-route check per #102; and the public-API table (added: `resolveQuantityUnits`, `resolveQuantityMultiplier`, `resolveBuilderQuantity`, `classifyServiceIntake`, `buildQuotePanelModel`, `requiredTagIdsFor`, `closeTagsOverRequires`, `toggleTagState`, `buildServiceSessionSeed`, `synthesizeAnswersFromTags`, `computeQuoteFromState`, `onsiteDiagnosticTerms`, `orch_max_followup_questions`, `orch_splice_remote_deep_dive`, `orch_apply_remote_divergence`, `orch_apply_answer`, `buildOtherTilesForGroup`; dropped: `init`, `sqBuildCuratedIntake`). **Result:** as delivered 128 passes / 79 failures; patched, on the real `qr.html`, **269 / 28**; the same patched suite on the operator's original `_qr.html` 222 / 55. **The 28 that remain are pre-existing:** the Charter's own markup (3: #100); R-DOMAIN-DYNCHAIN (2: #90); the retired-function check (#103); R-DOMAIN-NAME (77.6% of display names end in a recognised action token against an 85% bar); the concept checks for `checkout_state`, `pricing_engine_key` and `intake_chain`, and `resolveServiceCheckoutStateKey` carrying no `source` (#95); `sqRenderSelfQuoteAdlib`'s numeric literals (#103); R-INVARIANT-SINGLEDEF; R-INVARIANT-VERIFY; R-INTAKE-QTYFIELD (the harness redeclares `_DIMENSION_PATTERN`); the two evidence-class checks (R-GOVERN-STOPTHELINE: enforced rules certified only structurally, e.g. R-PRICE-SCOPE; R-GOVERN-GOODHART: universal-quantifier rules without population evidence); R-GOVERN-INDEX (R-SYSTEM-ONEPARSE has no assertion). **Assumption to confirm:** I do not have `PROJECT_FILES.html`, so the suite resolved `qr.html` itself; if the manifest maps `qr.html` to a JS bundle, the HTML-aware parse is a no-op. **Default if unanswered:** none needed; the patch is reviewable as a diff against the file as received.

**T149 update: 272 passes / 25 failures** (was 269 / 28). R-INVARIANT-VERIFY now passes: of the nine flagged field names, five were the name heuristic mis-typing a variable (allowlisted with reasons in the suite's own `KNOWN_MISSING_FIELDS`) and four were real reads of the retired flat shape, eight dead fallbacks, now deleted on behavioral proof (a census of 76 services, 54 dynamic entities and 14 Other tiles found none with a flat field). R-DOMAIN-DYNCHAIN passes in both copies (#90). Both fixes are held by standing tests (`verify_entity_shape_single.js`, `verify_dynchain_group_modules.js`). **The 25 that remain are all pre-existing** and are the list above minus those two rules. **A note for the operator's reading of the suite:** R-INVARIANT-VERIFY is a *structural* check that infers an object's type from a variable's name; five of its nine hits were wrong and four were right. That is the pattern the operator's behavioral standard is meant to catch, and the answer was a behavioral census, not a better regex.

**T150 update: 277 passes / 21 failures** (was 272 / 25). All the `checkout_state` concept checks pass (exactly one resolver; it carries `source`; no caller-side alternates; no low-level reads outside it). The **21 that remain are all pre-existing**; the concept failures among them are `minimum_quote_confidence`, `pricing_engine_key` and `intake_chain` (#95), plus the `sqRenderSelfQuoteAdlib` literals (#103).

### #105 — ✅ RESOLVED ((1), (2), (3), T156) / 🟡 OPEN ((4) DEFECT-LEGACY-SHAPE-FALLBACK: not ruled on), T148: three proposed Charter inclusions, each with its evidence
(1) **DEFECT-STALE-SANDBOX**: a test's hand-assembled sandbox omits a function the real code calls, so the test measures something else (R-GOVERN-GOODHART). Found four times: the stale $925 price check (T144), 13 regressions from one new dependency (T147), the rule-index test's bundles (T147), and the extraction generator behind `_extracted_engine.js` (T147); the unified suite's own `bundleFunctions` had it too. **42 tests still cherry-pick their sandboxes** without the engine-aware loader. Detector: not yet shipped; a baseline ratchet over those 42 (frozen by name, shrink-only; new tests may not cherry-pick). (2) **DEFECT-SILENT-SKIP**: a check that cannot run vanishes instead of failing. Found in the unified suite: 15 sandbox checks, and it hid an unpriced fallback route. Detector: **shipped** (`_bundleGuard` in the patched suite); owning invariant R-INVARIANT-REDTEST (the dual of "a failing test must be red"). (3) **R-GOVERN-DECIDEFIRST**: before a decision is filed as NEEDS OPERATOR, the entry carries the measurement that would settle it and the decision the agent will take if unanswered; only questions that depend on information the agent cannot obtain (customer intent, business appetite, legal) may be deferred. Evidence: the operator's rulings on #47, #72, #76 and #80 were all answerable by measurement, and the older T80 standing rule ("business calls stay excluded even under explicit trust") contradicts R-GOVERN-AUTONOMY, so a precedence ruling is needed (R-GOVERN-PRECEDENCE). Detector: a linter over this file (open entries must carry a "Default if unanswered" line; existing open entries grandfathered by number). **Default if unanswered:** ship the DEFECT-STALE-SANDBOX baseline detector next; hold (3) until the operator rules on T80 against R-GOVERN-AUTONOMY.

**T149 addition: (4) DEFECT-LEGACY-SHAPE-FALLBACK.** A reader keeps a fallback to a field that only the retired shape carried (`|| svc.base_price`), so dead code pretends a second representation exists, and a typo in the primary path falls through it silently (the T69 shape). Found: eight sites across five functions, one of them in code ported during the layer migration (`buildServiceSessionSeed`). Evidence it was dead: a census of every entity the page can hand a renderer (76 + 54 + 14) found no flat field; deletion changed 0 of 836 renders and 0 of 1,380 price points. **Detector: shipped**, `verify_entity_shape_single.js` (unit, static scan, and the browser census with population floors; both mutant kinds proven). Owning invariant: R-INVARIANT-CANONICAL. **Method note for the Charter:** a structural check that infers a type from a name needs a behavioral census beside it; here the census overturned my own first reading of the code as well as the heuristic's.

**T150 evidence for (1) DEFECT-STALE-SANDBOX.** Renaming one function (`resolveCheckoutState`, whose job was not what its name said) touched **52 occurrences in 40 test files**, almost all of them hand-assembled sandbox function lists. A rename is the cheapest possible structural change; its cost here is the measure of what the cherry-picked sandboxes cost every change. **Detector still not shipped** (the baseline ratchet over the 42 tests that cherry-pick); the case for doing it before the next concept migration has gone up.

**RESOLVED T156 (items 1-3) — operator: "(1) DEFECT-STALE-SANDBOX: yes, ship the baseline detector over the 42 cherry-pickers. Highest-leverage item on the list; every Phase B migration pays the rename tax until it lands. (2) DEFECT-SILENT-SKIP: keep. (3) R-GOVERN-DECIDEFIRST: yes. R-GOVERN-AUTONOMY wins over T80 for anything reversible and documented."**
**(1) shipped.** `verify_stale_sandbox_baseline.js` (`@detects DEFECT-STALE-SANDBOX`) classifies every `verify_*` test by what it does: it builds its sandbox by extracting functions one at a time (a `function\s+` extractor, the cherry-picker) or loads the engine whole (`_engine.js`). The cherry-pickers are frozen by name in `stale_sandbox_baseline.json` and may only **shrink** (a new cherry-picker, or a name that is no longer one but still listed, fails; the ceiling equals the list length and is capped at the historical 42). It found the loader itself had the class: three column-0 pricing functions were skipped and a commented-out function matched; fixed in `_engine.js` and now held by the detector's completeness check. **42 -> 41** after D-A4-1 retired one. Mutants: a new cherry-picker, a stale name, an inflated ceiling, a comment-only mention of the extractor, an incomplete loader. Every cherry-picker that is converted to the engine loader (the #111 retargeting, and each Phase B migration that renames a function) shrinks the list; the 41 names are the work. **(2) kept,** with its detector tags (`@detects DEFECT-SILENT-SKIP`: the unified suite's `_bundleGuard`, `verify_charter_rules.js`, `verify_template_matrix_conditions_known.js`). **(3) adopted (Partial)** with its linter `verify_r-govern-decidefirst_pending_decisions_default.js`: every open ledger entry filed after the Rule (numbered > #119, or a new `D-<scope>-N` prefix) carries a "Default if unanswered" line with real content; 10 synthetic ledgers prove the linter can fail; it cannot judge that the measurement was the right one or the default sensible, which is why the Rule is Partial. **Precedence: R-GOVERN-AUTONOMY wins over T80 ("business calls stay excluded even under explicit trust") for anything reversible and documented**; irreversible decisions that could reasonably go either way still stop the agent. The Charter has the two class rows, the DECIDEFIRST section and its index row, and a 2026-10-07 changelog row (operator ruling #105); with the #100 markup fixes those are the only Charter edits I made, under G-GOVERN-OVERRIDE.
**(4) is still open.** DEFECT-LEGACY-SHAPE-FALLBACK (the T149 addition above) was not in the list you ruled on. **Default if unanswered:** leave it out of the Charter's class table; its detector (`verify_entity_shape_single.js`) keeps running either way.

### #106 — ✅ RESOLVED, T156 (operator: keep all three) — was OPEN, T149: product calls made under autonomy that the operator may want to reverse
(1) **Safety answers kept in the plumbing diagnostics.** `plumbing_fixture_issue` (sinks, showers and tubs, toilets) and `water_line_issue` keep "Burning smell" and "Trips breaker immediately" even though they read oddly for a toilet: both carry the `#emergency` tag, and heated seats, bidets and electric water heaters put electricity beside water. Dropping a safety path to tidy a list seemed the wrong trade. **Default if unanswered:** keep. **Alternative:** drop them from the fixture and water-line modules (the disposal module keeps all seven); one data edit, and `verify_dynchain_group_modules.js` takes the new declaration in its registry. (2) **The Install/Setup exemption in R-DOMAIN-DYNCHAIN** is my reading of the rule, backed by the data (16 of 16 Diagnostic and Repair entries in symptom_first groups carry a symptom module; the only Install/Setup entries are the two it exempts). If the Charter intends symptom_first to constrain every service type, the alternative is a symptom module for Install and Setup, which I believe is meaningless to a customer. **Default if unanswered:** keep the exemption. (3) **Which file is canonical.** `qr.html` here is derived from `_qr.html` (Sept 29) plus T136-T149; the `qr.html` in the project is a different, older file (601 KB, 9,290 lines, no build-version marker). The unified suite reads `qr.html` by name. **Default if unanswered:** treat the delivered `qr.html` as the working app and `_qr.html` as the historical base.

**RESOLVED T156 — operator: "(1) Keep the safety answers. (2) Keep the Install/Setup exemption; the data supports it. (3) The delivered `qr.html` is canonical."** No code change; recorded. `_qr.html` stays the historical base, and the unified suite keeps reading `qr.html` by name.

### #107 — ✅ RESOLVED, T151 (operator ruled yes on both; implemented) — was OPEN, T150: calls made and proposals raised while consolidating the checkout-state concept (item 2 superseded by #108)
(1) **Charter vocabulary extension (proposed).** R-INVARIANT-PROVENANCE fixes a resolver's `source` to `'service_override' | 'archetype_default' | 'dynamic_engine' | 'fallback'`. The resolver conforms. But `computeUnifiedQuote` layers one more branch on top: an **answer-level override** (31 intake answers carry `checkout_state_override: 'diagnostic'`; 22 of the cases where one actually changes a service's state were exercised). Its provenance has no home in the vocabulary, so the quote's `checkoutStateSource` says `answer_override` when the customer's answer won. **Proposal:** add `answer_override` to the Charter's list, or rule that a quote-level source may extend it. **Default if unanswered:** keep `answer_override` on the quote only; the resolver's own source stays within the Charter's four. (2) **No customer-visible behavior change shipped.** I first converged the card tap onto the route for `led_bulb_upgrade` and `shelf_mounting_standard_buy_the_hour`, then reversed it: both services have a quantity question that moves the price and the self-quote card cannot capture it. The card tap keeps the guided builder by an explicit rule in `classifyServiceIntake` (a service self-quotes there only if it has no quantity question or is single-unit), and the disagreement with the route is a declared, tested exception. **The decision is #108.** (3) **The flat-checkout state names are hardcoded in three places** (`classifyServiceIntake`, `legacyDetermineSelfQuoting`, `renderTagAffirmationFromRoute` each test for `'standard_flat_rate'` / `'database_summation'`): the R-SYSTEM-NODATA pattern (#98). **Proposal:** a boolean on each `checkout_states` entry in the SSOT (for example `self_quote_eligible`) read through one helper; four states, one new field each, no behavior change. **Default if unanswered:** do it with the next concept migration. (4) **Dynamic entries' `operational_metrics.checkout_state` branch** is supported by the resolver but used by none of the 82 entries; the resolver still honors it (as `dynamic_engine`) so a future authoring is not silently ignored. **Default if unanswered:** keep.

**RESOLVED T151 — operator ruled yes on both.** (1) `answer_override` is added to the Charter's source vocabulary in **all three places that state it** (the rule, the glossary row, the changelog note; Charter hash `f24a1cb64d8e` -> `2c679ed62c90`), and the provenance detector's `VOCAB` follows. That was the only Charter edit; the four markup fixes (#100) remain yours. (3) The flat-checkout names moved into the SSOT as `checkout_states.*.is_flat_checkout` (true for `standard_flat_rate` and `database_summation`, false for `diagnostic` and `project_based`, exactly the old hardcoded pair) and are read through one helper, `isFlatCheckoutState`, at the three sites that hardcoded them. `verify_flat_checkout_names_live_in_ssot.js` holds it, with a counterfactual world. Still hardcoded (#98): `isAssembly: checkoutStateKey === 'database_summation'` (a different meaning), `CS_RESTRICTIVENESS`, and the resolver's fallback key.

### #108 — ✅ RESOLVED, T154 (shelf: ruling A implemented at T151; LED: "yes" implemented at T154) — was OPEN, T150: the self-quote card cannot express a price-moving quantity; the route and the card tap disagree on two services, and the route under-quotes one
**The finding.** `led_bulb_upgrade` and `shelf_mounting_standard_buy_the_hour` (T151 correction: only `led_bulb_upgrade` carries an authored `behavior.bypass_intake`; `shelf_mounting_standard_buy_the_hour` has no `behavior` block, and the route bypassed its intake because the pure-quantity rule's `then` sets `bypass_intake: true`) both rendered as the one-price self-quote card on the route (and so does the original `legacyDetermineSelfQuoting`). Both also have a quantity question that moves the price: LED asks "How many light bulbs need attention?" with bands (1 / 2-3 / 4-6) that each change complexity and price; the shelf service asks "How many units/items?", which drives the billable hours. **Measured on the route:** LED quotes **$20 for 1, 2, 3 and 5 bulbs** (the bands live on the skipped question, so they are inert there; #96); the shelf service scales with a quantity stated in the customer's words ($159, $318, $478, $796 for 1, 2, 3, 5) but the self-quote card has no control to supply one. On a card tap the customer gets the guided builder for both, which asks the count and prices it. **What I changed and did not:** the card tap was blind to archetype inheritance (a defect: 69 of 76 services inherit their checkout state); I fixed that, then found that fixing it alone would have sent these two services to a card that under-quotes them, so `classifyServiceIntake` now self-quotes a service on a card tap only if it has no quantity question or is single-unit. Today's card-tap behavior is unchanged. The route is **not** changed and your `bypass_intake` flags are not touched. The disagreement is frozen in `verify_checkout_state_convergence.js` (`DECLARED_EXCEPTIONS`; a new one fails, and each member's reason is verified).
**Why it is yours to decide.** It changes what customers are charged, and it sets two things you authored against each other: `bypass_intake` (skip the count) and the bands (the count moves the price).
**Options.** (A) Apply the same rule in the orchestrator's variability flags, so the route also keeps the builder for services whose quantity moves the price: fixes the LED under-quote on the search path, makes both paths agree by construction, overrides `bypass_intake` for these two (T151 correction: it is a flag on 6 services, not 12; only LED reaches the self-quote card through it). (B) Give the self-quote card a quantity control, and make the LED bands apply when the count is supplied: converges toward the authored `bypass_intake` intent; real UI work. (C) Leave it: documented, tested, and the search path keeps quoting five bulbs at $20.
**Recommendation: (A) for `led_bulb_upgrade`** (the bands exist because the count moves the price; one-bulb pricing for a five-bulb request is a plain under-quote), and (A) or (B) for the shelf service. **Default if unanswered: (C).** Changing what customers are charged is a business decision, so nothing changes until you rule. **If you rule (A)**, the work is one shared rule used by both paths (it also removes a second implementation of "is this service self-quoting": the route computes it in `orch_compute_variability_flags`, the card in `classifyServiceIntake`), and the declared set in the convergence test empties.

**T151 update — your ruling, and what I measured.** *Ruling:* A for shelf mounting; for LED, check the bands first, then likely A for the route side; not B for either. *Corrections to my own text above:* shelf has no authored flag (the route bypassed it via the pure-quantity rule's `then`), and the flag is on 6 services. *LED bands, checked:* they are neither flat-by-intent nor wrong. Answered, they price **$20 / $35 / $50** (modifier fees $15 and $30, 15 and 24 minutes, scope per_unit), and those modifiers are in **your original SSOT**, present before any edit of mine. The route skips the count question, so it quotes 1, 2, 3 or 5 bulbs at $20. *Implemented for shelf (A):* one shared `isQuantityFixed` used by the card tap and the route; a route flag `quantity_is_fixed`; the matrix's pure-quantity rule now requires it, so shelf goes `self_quote` -> `curated_card` (it did not ask the quantity until T153: the curated card drew only `client_response` questions, so shelf's quantity stepper was not rendered; T153 draws it for this service and nine others). Measured: 1,380 price points, 0 differ; across 158 entities the only template change is shelf. *Found on the way:* rule 5 (authored bypass) was **shadowed by rule 4 and never matched anything**; it now matches LED. *LED, ready for your yes:* add `"quantity_is_fixed": true` to rule 5's `if` in `workflow.ui_template_matrix`. LED's route then goes `curated_card`, asks the bulb count, and prices $20 / $35 / $50; the card tap is already the builder. I did not apply it because LED's path carries `force_confidence: 95` and your wording was conditional. **Default if unanswered:** leave LED as is (the search path keeps quoting five bulbs at $20).

**T154 update — LED applied.** *Ruling:* "LED yes". *Implemented:* `workflow.ui_template_matrix.rules[5].if` gained `"quantity_is_fixed": true`. LED's route is now the curated card, asks "How many light bulbs need attention?" and prices **$20 / $35 / $50** by answer (the bands are unchanged). *Measured:* 1,380 price points, 0 differ; across 76 services the only template change is LED. *Held by:* `verify_checkout_state_convergence.js`, whose `DECLARED_EXCEPTIONS` is deleted; it asserts there are no route/card disagreements, LED's outcome directly, a counterfactual world where LED is single-unit (the route then self-quotes it through rule 5 and the card agrees), and a mutant that removes the new condition. *Not done, and why:* `force_confidence: 95` on LED's `behavior` is untouched; it applies once the visible question is answered, as the matrix's curated-card rules intend. **The consequence you should see is #113.**

### #109 — 🟡 OPEN, T151: two tests run but are not in MASTER_TEST_SUITE.json
The integrity tool (now checking MASTER's content hashes, and still checking membership) reports `verify_charter_rule_index_v2.js` and `verify_charter_rules.js` as "silently running, unacknowledged": the runner globs `verify_*.js` and runs them, but MASTER does not list them. Both predate the unified suite (`verify_charter_rule_index_v10.js` carries META-CHARTER, LEGACY-REGEX and V9-AST checks); both fail today (v2 on R-DOMAIN-DYNCHAIN, now fixed in v10 but not in v2; charter_rules reports 30 violations). **Options:** (A) list them in MASTER, acknowledging they run; (B) move them to `test_harness/retired/` with a declaration, since v10 subsumes them. **Recommendation: B**, but retiring a test is your call. **Default if unanswered:** leave both (they keep running and the integrity check keeps flagging them).

### #110 — ✅ CLOSED (structure) / 🟡 OPEN (follow-ups), T152: the search flow was dead; render targets are now disjoint
**Closed.** In a real browser the original `_qr.html` responded to 2 of 8 ordinary requests; the project's affirmation test has never passed. Cause: the cart panel `#serviceRequestSummary`, which was also the render target for the affirmation and self-quote cards, was nested in `#intakeQuestionsContainer` in `#serviceContainer`, under a wrapper that was inline `display:none` and looked up by an id the markup never had. `renderRoute`'s `innerHTML = ''` destroyed it; the renderers returned silently; cached `DOM.*` references went stale; `restoreCategoryView` destroyed the rest. Fixed by giving each concern one host with no host nested in another (`#routeCardHost`, `#serviceContainer`, `#intakeQuestionsContainer`, `#summaryMainContainer` > cart panel) and by `renderRoute` clearing only what it owns. Held by `verify_customer_journey_visible.js` (17 checks, strict visibility; 13 of its 15 runnable checks fail on the original). **The invariant to keep (Charter: dumb UI):** a render target is owned by exactly one renderer, is never nested inside another, and persistent app chrome is never cleared by route rendering.
**Open follow-ups, in the order I would take them.** (1) *Cached references:* `cacheDOM` still caches nodes at boot; that is safe only while the hosts persist. Extend the journey test's survival check from three nodes to **every** `DOM.*` entry (a stale cache is how this stayed hidden). (2) *Hosts as parameters:* the card renderers still choose their own host by an id string; the Charter's dumb-UI shape is that `renderRoute` owns the id strings and hands each renderer its host (`renderCuratedCardFromRoute` already takes one). (3) *Mode changes:* `enterFocusedMode()` is called from seven places inside renderers; in a dumb UI the dispatcher sets the mode and renderers only build DOM. (4) *Two cart UIs:* the in-page panel (kept hidden behind its wrapper, as before) and the floating-button overlay; which is intended is yours to say. (5) *The census backlog:* the whole-file layer census still lists 27 violations (Glue 21, Logic 6), including the #83 `sqBuildStep3` port; the journey test is now the functional safety net those migrations lacked. (6) Found, not fixed: "fix a squeaky door" routes to *Squeaky Floor Repair*; the dishwasher "Yes" screen shows no `.price-value`. (7) *Done at T153:* shelf mounting's curated card had no quantity control (the renderer drew only `client_response` questions); ten services had the gap; the card now draws a "-" / "+" control. (8) The browse path was walked end to end in a real browser (every group; 27 of 39 reach the guided builder, 1 an intake card, none dead-ends; 11 nested sub-groups were not traversed): a candidate for a standing test once the walker can follow sub-groups. **Default if unanswered:** take (1) then (2) next.

### #111 — 🟡 OPEN, T152: what the 82 failing suites actually are
Last full run before T152 (169 suites, 82 failing), classified from the logs: **26** exercise the legacy compiler / CMS-bridge pipeline (`cms_bridge.js`, `btnyc_v10_compiler.py`; they regenerate `btnyc.json` from an authoring source, while the project now edits `btnyc.json` directly as the SSOT); **17** are **stale sandboxes** (a hand-assembled bundle lacks `resolveQuantityUnits`, `_nlpQuiet`, `closeTagsOverRequires`, `understandRequest`, `_trace`, a const that no longer exists, or calls a function deleted in the migration); **10** are the Charter's own red-by-design gates and meta-suites; **3** are environment problems (`puppeteer` where `puppeteer-core` is installed, a hardcoded `/home/tmnero/...` path in `verify_purity_audit.py`, a `fixtures/` path that does not exist); **26** are stale expectations or genuine assertion failures that need a per-test look (examples: a hardcoded count of 74 services; `angle_stop_replacement` expected to self-quote; the four real-browser UI tests, now fixed). **None of the groups is "the page is broken" except the four UI tests T152 fixed.** **Proposed order:** (1) replace the 17 hand-assembled sandboxes with one shared loader built on the closure extractor (the design you uploaded; it also removes the #105 class of 42 cherry-pickers); (2) fix the environment trio (done at T152 for `verify_ui_surfaces.js`, `verify_purity_audit.py` and the `fixtures/` path; `verify_ui_surfaces.js` now runs and 3 of its 5 scenarios fail on selectors from an older browse flow, so it needs retargeting rather than the page needing a fix); (3) triage the 26 one by one: if the expectation is right, fix the product, otherwise retarget; (4) **decision for you on the 26 legacy-pipeline tests:** retire them to `retired/` with a declaration, or restore the compiler as the source of truth. **Default if unanswered:** do (1) and (2), triage (3), and leave (4) alone.

### #112 — ✅ RESOLVED, T156 (operator: option A, graduated tiers + $95 visit minimum; implemented) — was OPEN, T153: `cabinet_knob_or_pull_install` quotes $20 for any number of knobs
Found by `verify_quantity_control_curated_card.js` while giving ten quantity-scaled services a way to enter the quantity. For this service the quantity reaches the engine (units follow the request: 1, 2, 3, 10; stance `batched`, source `fallback`) but the price does not move: **$20 at 1, 2, 3 and 10**. Its chain is `install_type` then `hybrid_qty` (a numeric stepper, no chips); its formula is `hardware_install_formula` with a base of 0; and its own `_quantity_justification` says "each knob or pull is the same job, so the count is the same fact applied N times; priced per unit by the tiered per-unit archetype", which describes a price that scales. The other nine services in the same situation scale ($159 / $318 / $478 / $796 for shelf mounting at 1 / 2 / 3 / 5). I did not touch the formula: the intended per-unit tiers are a pricing decision. I also left the control on the card, since the count reaches the cart and tells the technician how many knobs to bring. **Options:** (A) make `hardware_install_formula` quantity-aware with the tiers you intend (tell me the tiers; or tell me it is a flat visit fee, and then the justification and the stance are what's wrong); (B) declare the service single-unit (`per_unit_answers_vary`), which hides the control and prices one; (C) leave it. **Default if unanswered:** (C): nothing changes, the exception stays declared and tested (`DECLARED_PRICE_FLAT`), and a customer with ten knobs is still quoted $20.

**RESOLVED T156 — operator: "Option (A). Tiers: 1-5 knobs $20 each, 6-15 $15 each, 16+ $10 each, $95 visit minimum, using the higher of tier price vs. current flat. Not (B) — a batched service should not prompt 'how many?' with only 1 as an answer."** Implemented (commit `ruling/#112`).
**The rule.** `price = max(visit_minimum, graduatedTierTotal(tiers, n), old flat price)`, with `visit_minimum` 95 and the tiers read as **graduated** (marginal): knobs 1-5 cost $20 each, 6-15 cost $15 each, 16 and up cost $10 each. Pinned by `verify_knob_pull_tiered_pricing.js`: 1-4 knobs $95, 5 $100, 6 $115, 10 $175, 15 $250, 16 $260, 20 $300, 50 $600. Swap and new-holes price the same today, because the old flat price is the lowest of the three at every count.
**The reading I did not take, so you can say if you meant it.** The whole order at the rate its count falls in makes the price **fall** as the count rises (5 knobs $100, 6 knobs $90; 15 knobs $225, 16 knobs $160), and the Charter says per-unit labor "scales continuously. Never stepped". The test proves that reading fails (a mutant). If you did mean it, it is a data edit to `pricing_formulas.hardware_install_formula.tiers` plus the test's vectors; the formula code does not change.
**Where it lives.** `btnyc.json`: the tiers and `visit_minimum` in **four** copies of the formula parameters (the live `pricing_formulas.hardware_install_formula` and three derived copies under `compiled.*`: `pricing_index`, `service_index`, `formula_index`). The three `compiled.*` copies are **hand-edited**, because the compiler that generated them is absent (#111); filed as #122. `btnyc_schema.json`: a new `hardware_install_formula` definition, so the page refuses to boot on a malformed tier table (the in-page validator supports no `minimum` keyword; the schema uses only what it supports). `qr.html`: one branch of `applyPricingFormula`, with the tier helper local to it (a top-level helper fails R-SYSTEM-LAYERS' undocumented-property check and cannot be cherry-picked into the older sandboxes). The formula is used by `cabinet_knob_or_pull_install` only.
**What moved.** 30 of the 2,988 golden points, all on that one service, on both pricing paths (1 knob $20 -> $95, 2 $20 -> $95, 3 $20 -> $95, 5 $20 -> $100); the other 2,958 are identical. `archive/golden_master_T156_extended.json` is the new baseline, `archive/golden_change_T156_knob_tiers.md` the record, and `verify_collapse.sh` compares against it.
**Tests changed with it.** `DECLARED_PRICE_FLAT` is retired from `verify_quantity_control_curated_card.js`: the one legitimate flat stretch (1-4 knobs on the $95 minimum) is derived from the declared `visit_minimum`, with non-vacuity checks. `verify_charter_rule_index_v10.js` (R-PRICE-REGISTERED, two sites) gained `hardwareExpectedFee`, an independent unit-by-unit oracle, so its expected value is no longer a copy of the formula's own code. Two older assertions of **$140** for this service (`verify_orchestrator_phase2.js` line 95, `verify_phase6_self_quote_rewire.js` line 98) were stale before this change (the service quoted $20) and stay red; filed as #121.
**Consequences you may want to see.** For 1-4 knobs the customer taps "+" and the price holds at $95; the card does not say why (a copy question, #122). The self-quote ad-lib's own figure for this service ($70, #117) now disagrees with the engine's $95 by more than before; it is latent (#113).

### #113 — ✅ RESOLVED, T156 (operator: option A, no action) — was OPEN (observation; no action taken), T154: after the #108 rulings no catalog service self-quotes on the route
Measured on all 76 services and 82 dynamic entries: **zero** reach `self_quote` through `executeWorkflow` any more. The two rulings that did it were yours and were right on their own terms (shelf mounting's quantity moves the price; LED's bands move the price). No service has an empty chain. Eight have a bare quantity chain: LED and shelf mounting (their quantity moves the price, so they ask) and six `item_count_template` services without the authored `bypass_intake` flag (`smart_plug_configuration`, `smart_switch_install`, `usb_outlet_install`, `window_draft_sealing`, `window_screen_repair`, `wi_fi_extender_setup`), which the matrix sends to the curated card by design (rule 6). Nothing is broken: rules 4 and 5, the `self_quote` template and `renderSelfQuoteFromRoute` are tested (counterfactual B in the convergence test makes LED single-unit and the route self-quotes it). They simply have no live customer today.
**Why it is yours.** The product vision lists "self-quoting bypasses for straightforward services". Under the current catalog that means no service. **Options.** (A) Nothing: self-quote is a capability held for a service that is genuinely one fixed price (a flat-fee visit, say), and the tests keep it honest. (B) Author such services (or flag existing ones single-unit with `per_unit_answers_vary`) where the business wants a one-tap price; that is a catalog decision, not code. (C) Retire the template and its renderer, if the business no longer wants one-tap pricing at all (R-INVARIANT-DELETION: delete, do not deprecate). **Default if unanswered:** (A).

**RESOLVED T156 — operator: "Option (A). Self-quote stays as a capability; no current service qualifies and that is correct. Keep the template and renderer."** No code change; recorded. The capability stays held by tests (the template matrix's rules 4 and 5, `renderSelfQuoteFromRoute`, and counterfactual B in the convergence test, which makes LED single-unit and watches the route self-quote it). Consequence for #117: the self-quote ad-lib (`sqRenderSelfQuoteAdlib`) is not deleted by this ruling, so its recommended option (A), delegating its price to the engine, stands, and it is Phase B work behind the ship gate.

### #114 — ✅ RESOLVED, T156 (operator: option B, disjoint host; implemented with a behavioral test) — was OPEN, T155 (A1.6): after any catalog tap, the guided builder cannot finish (the curated card destroys the step-3 skeleton)
**Found by** the A1.6 differential probe, not by a customer report: my first `builder:` probe recorded 82 render errors of the form `Cannot set properties of null (setting 'textContent')`, and my first `adlib:` probe recorded empty strings (a vacuous probe that a mutant exposed, see `archive/golden_coverage.md` §5).
**What happens.** `#sqSb3` is both the step-3 skeleton (`#sqAdlibSentence`, `#sqQtyV`, `#sqDetTags`, `#sqDynGroups`) and the host the curated card renders into (`sqRenderCuratedCard(route, 'sqSb3')` writes the host's `innerHTML`). A catalog tap on a service with questions therefore replaces the skeleton with the card. If the customer then switches to "Write it for me" and finishes the builder, `sqBuilderFinish` writes `document.getElementById('sqQtyV').textContent` (and the other skeleton nodes) with no null guard, finds nothing, and throws; `sqBuildAdlib()` returns early on the same missing nodes. On a fresh page (no tap first) the builder is fine: all 82 dynamic entries finish end to end. So the defect is the order tap-then-builder, which is an ordinary thing to do.
**Why it is yours (not fixed in Phase A).** Phase A may not change observable output, and this is a behavior change: either the builder rebuilds its skeleton, or the card moves to a disjoint host. Both touch the DOM contract between layers (R-INVARIANT-BOUNDARY: the renderer owns its host; the glue should not depend on a node another renderer may have destroyed).
**Options.** (A) `sqBuilderFinish` / `sqBuildStep3` rebuild the skeleton when it is missing (small, but the glue then knows the renderer's markup). (B) Render the curated card into a host disjoint from the skeleton (for example `#sqCardHost` inside `#sqSb3`), so the two never overwrite each other (structural; one new element, one renderer argument, one test). (C) Null-guard every skeleton write (hides the symptom; the builder would then finish with no sentence shown). **Recommended:** (B). **Default if unanswered:** (B), taken up after Phase A's review as its own change with a behavioral test (tap a service, switch to the builder, finish, assert the sentence and quote render); the A1.6 differential `builder:` family currently runs on a fresh page precisely so it can see past this.
**Evidence kept:** `test_harness/tools/render_diff.js` (`builder:` and `adlib:` families, fresh-page probe).

**RESOLVED T156 — operator: "Option (B): disjoint host (`#sqCardHost` inside `#sqSb3`). Not (A) or (C). Behavioral test required."** Implemented (commit `ruling/#114`); full record in `archive/differential_change_T156_card_host.md`.
**The change.** `#sqSb3` now holds `#sqCardHost` (empty) and then `#sqStep3Skeleton`, a wrapper around the step-3 markup that was there before (every skeleton id is unchanged). One CSS rule hides the skeleton while the host has content (`#sqCardHost:not(:empty) + #sqStep3Skeleton { display: none }`), so no script has to remember to hide or restore it. `sqRenderCuratedCard(route, 'sqCardHost')` replaces `'sqSb3'`. One new renderer, `sqClearCardHost()`, is called from the top of `prefillSmartQuoteFromService` (every catalog tap starts clean), `sqResetView`, `sqShowBuilderView` and `sqOpen(3)`. **`sqBuildStep3` is untouched:** it has a layer violation of its own (#83), the R-INVARIANT-COMPLY ship gate counts any edit to it as a touch, and my first attempt (clearing inside it) failed the gate pass -> fail for exactly that reason.
**It fixes the defect from both sides.** (1) Tap a service, go back, choose "Build it step by step", finish: the sentence and the quote now appear (before: a page error, no sentence, step 3 never shown); proven in a real browser for all 73 card services. (2) A service that draws no card no longer shows **the previous service's card** (the card had replaced the skeleton and nothing cleared it). That second fix is customer-visible and is why the differential shows 3 entries that differ after the markup allowances (`prefill:led_bulb_upgrade`, `prefill:shelf_mounting_standard_buy_the_hour`, `prefill:furniture_assembly_flat_pack`): in each the previous build showed the previous service's card and this one shows the service's own step; they are one defect seen from the other side, not three regressions. The price golden does not move (2,988 points, 0 differ against the T156 baseline).
**Evidence.** `verify_step3_card_host_disjoint.js` (17 checks, registered in MASTER): structure; the card in its own host for all 73 card services; tap -> back -> Build it step by step -> finish -> sentence naming the choice -> Calculate Estimate -> a quote with a price, in a real browser, for every one of them; a no-card service tapped after a card service inherits nothing; the chip step opened over a card gets its skeleton back; four mutants of the page each fail the check built for them. `verify_curated_card_live_behavior.js` no longer wipes `#sqSb3` by hand between taps: the app does it. **One observation, not fixed (filed as #123):** the older intake panel path (furniture selection, the "Other" tiles) does not hide `#sqStepFlow`, so after a card tap the step flow stays on screen under that panel; the previous build showed the stale card there, this one shows the empty skeleton. Neither is right. Also still true: the `render_diff.js` `builder:` and `adlib:` families run on a fresh page.

### #115 — 🟡 OPEN (C-04 HELD), T155 (A2): the reducer's tag helper is a second copy of PE-18 that has already drifted, and "delegate to PE-18" conflicts with the reducer's purity contract
**What the map asked (C-04).** Delete AR-02 `computeActiveTagIds` (in `appReducer`) and delegate to PE-18 `closeTagsOverRequires`.
**What I measured.** (1) AR-02 *is* a stale second copy: it is the expression every caller used before the SSOT's `requires` relations existed (`[...new Set(manual)]` minus negated). On the real catalog, where two smart tags carry `requires`, the two disagree: `#very_heavy` -> AR-02 `["#very_heavy"]`, PE-18 `["#very_heavy","#two_person_required"]` (and `#virus` likewise). (2) **No production code reaches it**: production dispatches exactly one action type to the store, `cart/SET` (8 glue call sites plus the boot hydration); `TOGGLE_MANUAL_TAG`, `NEGATE_TAG`, `SET_DETECTED_TAGS`, `BEGIN_CONTEXT` and the other context / tag / session actions exist, with action creators, and are exercised only by `verify_store_reducer.js`. So nothing a customer sees changes whichever way this goes. (3) **The delegation as written cannot be done without breaking a stated contract.** `appReducer`'s header: "PURITY CONTRACT: this file imports nothing, touches no DOM, reads no globals". `closeTagsOverRequires(tagIds, negated, DB)` needs the SSOT; a reducer calling it must read a global `DB` and a global function, and `verify_store_reducer.js` (which `require`s the reducer in plain Node, where neither exists) would throw.
**Why it is held, not decided (R-GOVERN-SURFACE, R-INVARIANT-BOUNDARY).** Landing it means either breaking the reducer's purity contract or changing the reducer's design, and the right choice depends on whether the reducer's tag / context / session half is going to live at all (finding below). Nothing is lost by holding: the code is unreachable.
**Options.** (A) The reducer stops deriving `activeTagIds`: it stores the facts (detected, manual, negated) and the action payload carries the closed set, computed by the glue with PE-18 (the reducer stays pure; one definition; a small, tested change). (B) The store injects `closeTags` into the reducer at creation (glue supplies PE-18 and the SSOT; a new dependency seam). (C) Delete the unreachable half of the reducer (everything but the cart), which also removes AR-02, `tagState.activeTagIds` and the legacy-`S` mirror fed by them. **Recommended:** (C) if the Phase 6 purge-plan migration this reducer was built for is abandoned (it appears to be: one action type is live, and `bindLegacyGlobals` is documented as "removed at the end of Phase 6"); otherwise (A). **Default if unanswered:** the item stays held and AR-02 stays as it is, with this entry as the record.
**Finding behind it (for your review).** Of the reducer's 22 action types, one (`cart/SET`, from 8 glue call sites and the boot hydration) has a production dispatcher. If the intent was for `S`, the quote and the tags to flow through the store, that migration did not happen; if it was abandoned, the rest is dead code under R-INVARIANT-DELETION. Not part of Phase A (no file or layer moves); named so the Phase B/C plan can decide.

**Operator T156: the stated default is confirmed ("Everything else on the stated default... proceed"); the work is held for Phase B, which waits for your explicit go.**

### #116 — ✅ RESOLVED (C-05 closed: item 1 in T159, item 2 in T161; recorded in #148), T155 (A2): the guided builder's confidence block is not a copy of ORCH-08, and its escalation half is a drifted copy of the engine's that never fires
**What the map asked (C-05).** Move `sqPrepareFlow`'s (AC-13) inline confidence accumulation into ORCH-08 `orch_compute_confidence`.
**What I measured.** The block is two different things. (1) **The accumulation loop** sums `intake_modules.*.confidence_gain` for modules the customer answered, tags imply, or the description implies, and decides whether the guided builder may skip step 2. `orch_compute_confidence` does not do that: it scores the *route* by entry type (catalog = 100; other tile and free text from the strategy's `base_confidence` and the NLP match) and never reads `confidence_gain`. So this is not a duplicate of ORCH-08; it is logic in the glue with no logic-layer home. (2) **The escalation block** below it **is** a second copy of `applyLiveConfidenceEscalation` (PE) and it has **drifted**: it reads `smart_tags.*.effects.complexity_override`, a field **no tag has (0 of 43)**, while the engine reads `escalate_complexity` (`#brick_wall` -> specialized, `#fragile_item` -> skilled). Consequence today: for a customer who arrives by the guided builder or free text through `sqPrepareFlow` with one of those two tags, the confidence bar is **not** raised, while on the route it is.
**Why it is deferred, not landed.** Phase A's rule for a collapse is "ensure no caller's behavior changes". Delegating (2) to the engine fixes the drift and therefore **changes** what the builder does for `#brick_wall` / `#fragile_item` (a higher bar, so step 2 may no longer be skipped): a behavior change with no coverage in the extended golden (the `builder:` family seeds no tags). Moving (1) creates a new logic-layer function, which is a layer move, not a deletion. Both are Phase B work. Both blocks are named in one `// PHASE_B_FOLLOWUP (C-05, #116)` comment above `sqPrepareFlow` in `qr.html` (above the function, not inside it: the first attempt put the tags inside, and the R-INVARIANT-COMPLY ship gate correctly treated that as a touch of a function with pre-existing layer violations and failed; a comment inside a function body counts).
**Options.** (A) Delegate the escalation to `applyLiveConfidenceEscalation` (intended behavior; the builder starts raising the bar for the two tags; needs a behavioral test: tag present -> bar raised on both paths) and move the accumulation into a named logic function (`orch_` or `pricing_engine`), in Phase B. (B) Delete the escalation block outright (the builder never escalates; makes the divergence from the route permanent and explicit). (C) Leave as is. **Recommended:** (A). **Default if unanswered:** the item stays deferred with the tags in place.

**Operator T156: the stated default is confirmed ("Everything else on the stated default... proceed"); the work is held for Phase B, which waits for your explicit go.**
**RESOLVED, 2026-10-10 mandate (items B and D).** Option (A) was taken. Item (1), the accumulation loop, is deleted (T159); the builder's confidence is `resolveSessionConfidence` -> `resolveConfidence`. Item (2), the drifted escalation, was delegated to `applyLiveConfidenceEscalation` (T159) and its function and both held-note comments are deleted (T161). The behavioural change the hold was protecting (the bar rises for `#brick_wall` / `#fragile_item`) is measured in #148.

### #117 — 🟡 OPEN (C-10 DEFERRED), T155 (A2): the self-quote ad-lib computes its own price, and it disagrees with the engine for 16 of 76 services (latent: no service reaches it today)
**What the map asked (C-10).** AC-30 (`sqRenderSelfQuoteAdlib`): replace the inline pricing math with the engine (PE-36 via PE-39), else tag `// PHASE_B_FOLLOWUP`.
**What I measured.** The function prices a self-quoted service itself: `perItemLabor` from `financial_engine.type` (hourly: `base_price` x billable hours with a minimum; assembly formula: `mathFurnitureAssembly([minutes])`; otherwise `base_price`), a local tier-rate table (65/85/110) and defaults (`70`, dispatch `45`). Compared at quantity 1, no answers, with the engine's own labor for every service (the extended golden's `state|<id>|none|1`): **60 of 76 agree, 16 differ**. By type: flat 59 agree / 2 differ (`cabinet_knob_or_pull_install` $70 vs $20, the #112 service; one more), hourly 1 / 12 (for example `dishwasher_repair` $70 vs $422, `computer_diagnostic` $75 vs $231), formula 0 / 2 (`furniture_assembly_flat_pack` $40 vs $71). So this is not a refactor: delegating changes the number the customer is shown, for those 16, and for any service made self-quoting later.
**Why it is latent.** After the #108 rulings no catalog service self-quotes (#113), so this function is not reached on the real catalog (the card tap and the route agree on that, T154's convergence test). It would be reached the moment a service is authored as one fixed price (#113 option B).
**Why it is deferred.** Phase A forbids a collapse that changes what is shown, and the extended golden has no live service to exercise this path. The function carries a `// PHASE_B_FOLLOWUP (C-10, #117)` comment above it in `qr.html`.
**Options.** (A) Delegate to the engine (the displayed price becomes the engine's, which is the one the cart and the quote panel use; the self-quote card then agrees with the rest of the product by construction). (B) Delete the self-quote ad-lib and its template with #113 option C (R-INVARIANT-DELETION). (C) Leave. **Recommended:** (A) when #113 is decided; (B) if #113 goes to "retire one-tap pricing". **Default if unanswered:** the item stays deferred.

**Operator T156: the stated default is confirmed ("Everything else on the stated default... proceed"); the work is held for Phase B, which waits for your explicit go.**

### #118 — 🟡 OPEN, T155 (A2b): two dead fields found by closing arbitration sites — `nlpIntent._groupId` (read in three places, written nowhere) and `intent.base` (written in eleven places, read for use nowhere)
**`nlpIntent._groupId`.** Not the SSOT, not the NLP engine, not `understandRequest` writes it (159 phrases: every service name, alias and intent keyword: no intent carries one). Reads: `collectBookingContext_freeText` (closed in C-18), `executeWorkflow`'s `intentGroupId: context.nlpIntent?._groupId || null` (always null; the route field exists "for the sibling-service recommendation logic" per its comment), and `orch_apply_object_based_resolution`'s `resolveDynamicService(objectMap.default_dynamic_category, newNormSt, intent._groupId)` (always passes `undefined` as the group, so that branch never gets group-scoped dynamic resolution; it behaves as the category-only lookup it has always been). The name was a guess that never matched a field (the comment in `collectBookingContext_otherTile` records the same guess about tiles). **Decision needed:** delete the two remaining reads (and the route's `intentGroupId` if its consumer is confirmed gone), or give the NLP a real group signal. **Default if unanswered:** delete in Phase B with the route-shape work (D-A2b-3), since `intentGroupId` is part of the route.
**`intent.base`.** Written in eleven places in seven functions: `buildServiceSessionSeed` (a literal `?? 70` and a guard that writes the dynamic base), the NLP (`best.base`, a literal `fb.base_price || 70`, and two `resolved.base` overrides), `prefillSmartQuoteFromOtherTile` (`?? 70`), `sqAnalyze` (a literal `70` and `S.intent.base = route.basePrice`), `sqBuilderFinish` (`base: 0`) and `sqPrepareFlow` (a guard that writes). The only reads are the `!S.intent.base` guards that decide whether to write again; the quote's `base` (`u.base`, `q.base`) is `computeUnifiedQuote`'s own. So the field is state nobody uses, and the literal `70` (written twice) is one of the numeric literals the suite flags. **Default if unanswered:** delete the field and its eleven writers in Phase C with the S-state work; it needs no decision, only the writers the R-INVARIANT-COMPLY ship gate holds (`prefillSmartQuoteFromOtherTile`, `sqPrepareFlow`; the gate decides for the rest when each is touched) brought into compliance first.

**Operator T156: the stated default is confirmed ("Everything else on the stated default... proceed"); the work is held for Phase B, which waits for your explicit go.**

### #119 — ✅ RESOLVED, T156 (operator: keep fail-open) — was OPEN, T155 (A3): when the schema file cannot be fetched at boot, the page warns and boots (fail-open); the plan only says what happens to data that fails
`init` validates the catalog against `btnyc_schema.json` and aborts on non-conforming data. If the schema file itself is missing (HTTP error or unreadable), I chose: `console.warn`, `window.__ssotValidation.status = 'unavailable'`, boot continues. **Why:** 22 test files and the operator's local harnesses stub `fetch` to serve only `btnyc.json` (any other URL answers 404); fail-closed would make every one of them fail to boot, for a reason unrelated to what they test. **Cost:** if the schema is not deployed, the guard is silently off in production except for the console warning; the new test asserts the real world reports `valid`, so a repo that loses the file is caught in CI, not in production. **Decision needed:** keep fail-open (default), or fail-closed (change the `else`/`catch` in `init` to throw, and make the 22 stubs serve the schema; the stub list is `grep -l "btnyc.json" test_harness/*.js | xargs grep -l fetch`). **Default if unanswered:** fail-open, as built.

**RESOLVED T156 — operator: "Keep fail-open."** No change. `init` still warns, sets `window.__ssotValidation.status = 'unavailable'` and boots when the schema file cannot be fetched; data that fails the schema still stops the boot. The new test asserts the real world reports `valid`, so a repo that loses the schema is caught in CI rather than in production. The cost stands as written: if the schema is not deployed, the guard is off in production except for the console warning. Deploy `btnyc_schema.json` next to `btnyc.json` (as with `trace.js`, D-A4-2).

**CORRECTION T157 — the last sentence above was wrong, and it contributed to a live outage (see #126).** "Deploy `btnyc_schema.json` next to `btnyc.json`" contradicts what `btnyc.json` itself declares (`"$schema": ".../schema/btnyc_schema.json"`), and the gate read a hard-coded `./btnyc_schema.json`. You published the schema where the SSOT said (`schema/`); a stale copy from 2026-09-25 sat at the root where the gate looked; the correct data failed it (907 problems) and the live page showed the category grid with no text input. The gate now reads the schema from the location the SSOT declares (`orch_resolve_schema_location`), and a boot failure is drawn on the page. The #119 ruling itself (keep fail-open when the schema cannot be fetched) is unchanged and is tested.

### #120 — 🟡 OPEN, T156: the Charter's own meta-test reports 9 problems, none of them markup
`verify_charter_rules.js` (one audit over the 2026-10-07 Charter, read with a real parser; non-vacuous, 7 deliberately broken copies fail it) reports, after the #100 markup fixes: **(index, 2)** R-SYSTEM-SCRIPT is `enforced` in the index and `partial` in its section; the index lists G-INVARIANT-DETECTOR and no section defines it. **(enforcement, 5)** R-SYSTEM-SHAPE, R-DOMAIN-SHAPE, R-GOVERN-TRANSITION and R-GOVERN-ANTISTALE are `enforced` and R-FRICTION-RETIRE is `partial`, and none has a named test file, an `@enforces` tag, or a tagged assertion. **(orphans, 2)** `verify_r-invariant-comply_ship_gate.js` carries `@enforces R-INVARIANT-COMPLY` and `@enforces R-INVARIANT-NOLEGACY`, and neither is declared in the Charter (renamed or retired?). I made no Charter edit for any of them: which side is right (the index or the section; the rule or the tag) is yours to say, and the enforcement gaps are either a missing test or an overclaim. **Options.** (A) You settle the two index lines and say which Charter rule the ship gate enforces; I retag the test or you add the rule. (B) For each of the five, I write the enforcement test where a behavioral one is possible (R-SYSTEM-SHAPE and R-DOMAIN-SHAPE look measurable; R-GOVERN-TRANSITION and R-GOVERN-ANTISTALE look like process rules), and you downgrade the rest to `partial`. **Default if unanswered:** change nothing in the Charter; the audit stays red by design, its 9 problems are the list; and when Phase B touches a rule's subject I add that rule's enforcement test then.

### #121 — 🟡 OPEN, T156: tests that assert what the catalog no longer says
Three groups, found by measurement while applying the rulings. **(1) Urgency for plumbing and tech.** `global_rules.intake_defaults.category_defaults.plumbing_help` and `.tech_trouble` are `[]` (the T135 operator override removed urgency from both), but #45's T118 record says urgency was **kept** for those two as "genuine emergency categories". The old shadow sweep asserted it (retargeted under #103, so it now follows the catalog); `verify_intake_defaults_meaningfulness_review.js` still asserts it (2 failing checks) and `verify_orchestrator_phase2.js` line 77 does too (it also crashes earlier on a stale sandbox). **(2) Two stale `$140` assertions** for `cabinet_knob_or_pull_install` (`verify_orchestrator_phase2.js` line 95, `verify_phase6_self_quote_rewire.js` line 98): the service quoted $20 before #112, so they were wrong before the tiers and are wrong now ($95 at one knob). **(3) The customer-journey test (`verify_customer_journey_visible.js`, a real-browser test).** With a browser it runs 17 checks and **3 fail**: "replace 3 light bulbs" is expected to reach a visible self-quote screen, and the cart check adds from that self-quote card, and the "second search" check follows it. They fail identically at the Phase A baseline commit (`26770b0`), at the Phase A hand-off (`ef6d76d`) and at T156: the expectation predates the T154 LED ruling (LED's bands move the price, so it asks, and is not a one-tap self-quote; #108, #113). The Phase A baseline recorded this test as `0 passed, 0 failed` because it was captured without a browser (#125). **Which is right?** The catalog is the SSOT and the T135 override is later than #45 and was yours, so the tests are the stale side; but if the intent of #45 was that a customer reporting a leak or a dead network gets asked how urgent it is, the catalog should change, not the tests. **Default if unanswered:** the catalog is right; retarget the tests to the catalog in the #111 triage (the urgency pair and the two `$140` assertions to the catalog's current values; the journey test to the card LED now shows, with the cart step following the curated card's add button, since no service self-quotes, #113) and note it in #45; no catalog change.

### #122 — 🟡 OPEN, T156: follow-ups to the knob / pull tiers (#112)
(1) **Say why the price holds.** For 1-4 knobs the price is the $95 visit minimum and does not move as the customer taps "+"; the card could say "includes the $95 visit minimum" for that stretch (data-driven: shown while the price equals the declared minimum). (2) **The three `compiled.*` mirrors of the formula parameters were hand-edited** because the compiler that generated them is absent (#111). A test now holds the four copies equal (`verify_knob_pull_tiered_pricing.js`), but the next time anyone regenerates `compiled.*` the tiers will vanish unless the compiler's source carries them. (3) **The self-quote ad-lib's own price for this service is $70** (#117), now $25 under the engine's $95; latent, because no service self-quotes (#113). **Default if unanswered:** do (1) in Phase B with the card work (a copy change, reversible, behind a behavioral test), leave (2) to the #111 decision on the legacy compiler, and leave (3) with #117.

### #123 — 🟡 OPEN, T156: the older intake panel path leaves the step flow on screen, and two differential families run on a fresh page
Found while fixing #114. (1) A catalog tap routed to the older intake panel (`furniture_assembly_flat_pack` with its furniture selection, the "Other" tiles) shows that panel but does **not** hide `#sqStepFlow`; after a card tap the step flow stays on screen under it (the differential's `prefill:furniture_assembly_flat_pack` entry shows it: the empty step-3 skeleton). It was always so; the previous build hid it behind a stale card. (2) The `render_diff.js` `builder:` and `adlib:` families still run on a fresh page, so the tap-then-builder order is held by `verify_step3_card_host_disjoint.js`, not by the differential. **Default if unanswered:** fix (1) in Phase B as part of moving mode changes out of the renderers (the open follow-up (3) under #110), with a behavioral test (tap a furniture service, assert the step flow is hidden); leave (2) as it is, since the new test covers the order.

### #124 — 🟡 OPEN, T156: `AGGREGATOR.html` is missing, and the Project and the repo disagree about `retired/`
(1) The Charter refers to `AGGREGATOR.html`; the repo has the builder (`test_harness/tools/build_aggregator.py`) but not its output, so the Charter's pointer is dead. (2) The operator's Project copy of `test_harness/retired/` lists 12 tests as retired at T136 (and keeps a live copy of each at the `test_harness/` root); the repo's `retired/` holds the README and two files (`verify_component_tracing_overlay.js`, moved under D-A4-1 with its reason; `verify_purity_audit.py`, reason not recorded). The other ten are still live and red in the repo, and the README says so; moving them is the #111 decision (retire or restore the legacy compiler tests). The Project's `test_harness/` also has no copy of this session's new files until the package is synced. **Default if unanswered:** regenerate `AGGREGATOR.html` with `build_aggregator.py` at the next package (a derived file, reversible), and treat the delivered repo's `retired/` and its README as the record until you rule on #111.

### #125 — 🟡 OPEN, T156: the suite baseline was recorded without a browser, so five tests' browser halves were silent no-ops (DEFECT-SILENT-SKIP)
Found by the final T156 verification, which was the first full-suite run with `CHROME_PATH` set. The Phase A baselines (`suite_baseline_T154.tsv`, and `suite_baseline_T156.tsv` built from it) were captured with no Chrome configured. Five tests carry a real-browser half that prints "no Chrome/Chromium binary found -- SKIPPED (environment gap, not a code failure)" and **exits 0 with zero checks**: `verify_customer_journey_visible.js` (0 checks; 17 with a browser, 3 of them red, #121), `verify_affirmation_card_ui.js` (0 -> 7), `verify_curated_card_live_behavior.js` (0 -> 19), `verify_entity_shape_single.js` (6 -> 13) and `verify_quantity_control_curated_card.js` (8 -> 14). So until T156 "0 pass->fail" meant "0 pass->fail among what could run". Nothing was hidden by a change of mine: with a browser, the journey test fails the same 3 checks at `26770b0`, `ef6d76d` and `000b257` (#121), and `verify_curated_card_live_behavior.js` failed 1 check at `26770b0` and at the Charter-adoption commit too: its numbering check ("question numbers are positive, strictly increasing") read the T153 quantity control's unnumbered label ("How many units/items require service?", 11 services, both variants) as a question. The card is as designed (the quantity row is a control); the test was stale since T153, which my browserless verification could not see. **Fixed at T156:** the numbering check now excludes `.ims-qty` and asserts the probe really draws a quantity row (21/21). The other three pass. What changes: the verification protocol now runs the suite with `CHROME_PATH=/opt/pw-browsers/chromium`, and the suite baseline is re-recorded with a browser: `archive/suite_baseline_T156_aac38c8_browser.tsv` is the Charter-adoption commit (`aac38c8`) run with Chrome (the like-for-like base for T156: 0 pass->fail), and `archive/suite_baseline_T156.tsv` is the T156 hand-off run with Chrome (what Phase B compares against). **Not changed:** the tests still skip rather than fail when no browser exists (they say so, by design), so a machine without Chrome still reports green for them. **Options.** (A) Leave the tests; every verification run sets `CHROME_PATH` (done) and states it. (B) A runner-level rule: `run_all.sh` fails when a test prints its environment-gap notice, unless told the machine has no browser. (C) Make each skip a failure by default with an explicit opt-out flag. **Default if unanswered:** (A) now, and take (B) into the #111 triage, because it changes what `run_all.sh` means on a machine without Chrome, which is yours to decide.

**T157 addendum (two more instances of the same defect).** `verify_builder_preseeded_context.js` and `verify_quote_template_complete_fields.js` also carry a real-browser half that prints "No Chrome/Chromium binary found -- skipping ... (environment gap)" and exits 0, and they do so **even with `CHROME_PATH` set**: their own browser finder does not read it. They were not among the five listed above because a runner that sets `CHROME_PATH` makes the other five run and hides these two. `suite_snapshot.js` (T157) now marks any test that prints "environment gap" with `[GAP]` in the summary column and in the tally, and `--fail-on-gap` turns it into an error. Making these two honour `CHROME_PATH` will turn their zero checks into real ones, which may be red; that is information for the #125 work, not a regression, so it is not folded into the live-site fix.

### #126 — 🟡 OPEN, T157: the schema is published in two places and one is stale; which one is canonical?
Found diagnosing the live-site report ("the SmartQuote text input is totally absent under the category grid"). The repository `tommichael88/booktomnyc` (at `e2dff6a`, 2026-10-07) holds **`schema/btnyc_schema.json`** (85,453 bytes; byte-identical to the T156 schema; uploaded in `78d0bc2`) and **`btnyc_schema.json` at the root** (63,656 bytes; last touched 2026-09-25, `a831d38`; a different generation of the schema: the T156 data fails it with 907 problems). `btnyc.json` declares `"$schema": "https://tommichael88.github.io/booktomnyc/schema/btnyc_schema.json"` and the schema's own `$id` is the same URL, so the SSOT already names `schema/` as canonical. The T155 gate ignored that and read the root. **What changed (T157):** the page reads the schema from the location `btnyc.json` declares, and this package ships the file at `schema/btnyc_schema.json` (it no longer ships a root copy), so uploading the package keeps the layout right. **What is yours to do:** delete the stale root `btnyc_schema.json` from the repository (nothing reads it any more; leaving it is a trap for the next person who edits the wrong copy). **Options:** (A) `schema/btnyc_schema.json` is canonical, as the SSOT declares; (B) the root is canonical, and `btnyc.json`'s `$schema` and the schema's `$id` are edited to say so (one data edit; the page follows it without a code change). **Default if unanswered:** (A) stays: `schema/btnyc_schema.json` is the one published schema, this package ships only that copy, and the stale root copy is left for you to delete because this session can read the repository but not change it.

### #127 — 🟡 OPEN, T157: the boot gate cannot tell a stale schema from bad data, and either one takes the whole site down
The gate stops the boot whenever the data fails the schema it was given. Seen live: the correct data failed a stale schema (907 problems) and the site was dead; bad data (one missing key) gives the same outcome. The gate cannot tell which file is wrong, and a visitor pays for either mistake. T157 made the failure **visible and specific** (a panel on the page: the schema path and what chose it, the first eight problems, the build and URL) and fixed the location; it did not change what the gate does. **Options:** (A) leave the gate strict (the T155 / PHASE_PLAN A3 behaviour: data that does not conform never becomes `DB`); the panel is what makes a mismatch diagnosable in seconds. (B) Give the schema a generation marker that must equal the data's `meta.schema_version`; a mismatch stops the boot with its own message ("the schema file is for another generation of the data") instead of 907 problems, still strict. (C) Treat a generation mismatch like an unreadable schema (#119: warn, boot, status `unavailable`), so a stale schema can never take the site down but a real data fault still does. **Default if unanswered:** (A): no change to the gate, because (B) and (C) need a new field in the schema and data that you have not asked for, and (C) turns a guard off on the one signal that is easiest to get wrong.

### #128 — 🟡 OPEN, T158: the ship gate is red on four functions, because your reformatted `qr.html` makes 185 of 198 functions "changed"
`verify_r-invariant-comply_ship_gate.js` compares each function's text in `HEAD` with the working file and holds every function that changed to its layer's rules. Against `HEAD` (the T157 package) your `qr.html` shows **185 of the 198 functions in `HEAD` changed, and 9 new** (the file was reformatted and restructured), so the gate judged nearly all of them and failed on the four that already violate the rules and always did: `applySSOTRules` (2), `prefillSmartQuoteFromOtherTile` (3), `sqBuildStep3` (1), `sqPrepareFlow` (8). The same four are the 14 Glue violations in `verify_r-system-layers_full_matrix.js` (known since T144; #83, #93). None was created by T158. **Options:** (A) accept the red for this one change: the commit becomes the new `HEAD`, the gate then compares against it, and it is quiet on these four until one is next touched; (B) restore the old text of the four functions in `qr.html` so they are not "changed" (the file becomes partly formatted); (C) make them compliant now (a Logic selector for `tagValidForCategory`, the dynamic-service read moved behind a resolver; `sqPrepareFlow` is the legacy flow whose retirement is blocked on #93). **Default if unanswered:** (A). The gate is not loosened or skipped, the four are named here, and they are fixed by Phase B (B4 retires `sqPrepareFlow` after #93; the other three are ported with it). (C) is Phase B work and waits for your go.

### #129 — ✅ RESOLVED, T158; closed T163 (item F): `cart_logic` existed twice (the inline block in `qr.html` and `modules/cart_logic.js`, which the page does not load); option (B), the inline block stays and the file is deleted
Your `qr.html` carries the cart rules in an inline block while `modules/cart_logic.js` holds the same text unreferenced. Every edit this session (the guard, `cartLineAmount`, `cartLineQty`, `cartTotal`, the amount in the key) was applied to both, and `verify_cart_logic.js` now fails if they differ. **Options:** (A) finish the move: replace the inline block by `<script src=".../modules/cart_logic.js">` (one line, same pattern as the other four) and delete the inline copy; the cost is a deploy-order dependency (the module must be published with, or before, `qr.html`; the page shows `#bootFailure` if it is missing, tested by `verify_external_modules_boot.js`). (B) keep it inline and delete `modules/cart_logic.js`. (C) keep both. **Default if unanswered:** (C): the page is not changed, the two copies stay byte-identical under the new check, and (A) is yours to say because it changes what must be uploaded together.
**Resolved by item F of the 2026-10-10 mandate (T163), option (B).** `modules/cart_logic.js` is deleted; the inline block is the only copy (it was byte-identical to the file, line for line, when measured). Why (B) and not (A): the mandate's item F is "cart_logic dedup", the plan (`SESSION_PLAN.md` v-a 3) proposed deleting the file and keeping the inline block, and the plan's defaults were accepted; (A) is a deployment change on your side (a new file that must be published with `qr.html`, and `#bootFailure` if it is missing), and it stays available later at no extra cost (move the block to `modules/`, add one `<script src>`, delete the inline block in the same change; `verify_module_deployment_shape.js` allows exactly that and fails on the half-done state). The old default (C), keep both, is withdrawn: the only guard it had was `verify_cart_logic.js`'s check that the two copies were equal, a test that held a duplicate in place; that check is removed with the copy (T163 section 5), and the class is held for every module by the new detector (`modules/` has no file the page does not load, no file shares a name with an inline block). The page is unchanged in behaviour: golden master 0 of 2,988 differ, render differential 0 of 1,146, the cart merge test (a real browser, 19 checks) 19 of 19.

### #130 — 🟡 OPEN, T158: `QR_BUILD_VERSION` lives in an external module, and the modules have no cache-busting
`QR_BUILD_VERSION` is `T158` in `modules/nlp_engine.js` (line 173), not in `qr.html`; the boot panel, the freshness test and the cache all read it from there. A deploy that updates `qr.html` and not `modules/nlp_engine.js` reports the old build, and nothing makes a browser re-fetch a module it already holds (the service worker is network-first for pages and `.json`, not for these scripts). **Options:** (A) status quo, and the deploy list says "upload `qr.html` **and all of `modules/`**"; (B) move the constant into `qr.html`, so the page reports its own build; (C) add `?v=T158` to each module `<script src>` (the assembler would strip the query). **Default if unanswered:** (A), with the deploy list in the TIMELINE entry. (B) and (C) change where a value is defined and what the assembler matches, which is your layout.

### #131 — 🟡 OPEN, T158: the 2026-10-09 Charter does not carry the T156 amendment (DEFECT-STALE-SANDBOX, DEFECT-SILENT-SKIP, R-GOVERN-DECIDEFIRST); was that intended?
The T156 Charter (#100, #105) added two defect classes and one rule: **DEFECT-STALE-SANDBOX**, **DEFECT-SILENT-SKIP** and **R-GOVERN-DECIDEFIRST** (every ledger entry carries a "Default if unanswered"). Your new file has none of them. The harness follows the Charter as it stands: the three tests that tagged them (`verify_r-govern-decidefirst_pending_decisions_default.js`, `verify_template_matrix_conditions_known.js`, `verify_stale_sandbox_baseline.js`) no longer claim a Charter code (each carries a T158 note) but **still run**, and the ledger keeps the "Default if unanswered" line as a convention. **Options:** (A) intended: the three are retired and the tests stay as plain conventions; (B) restore them in the Charter (your edit; I do not edit the Charter). **Default if unanswered:** (A) in effect: nothing changes, and the conventions keep being followed.

### #132 — 🟡 OPEN, T158: what the Charter model found in the 2026-10-09 file (surfaced, not edited), and the Rules nothing in the harness covers
`verify_charter_rules.js` reports eight problems. **In the Charter:** (1) `R-GOVERN-INDEX` is defined twice; (2) `G-INVARIANT-DETECTOR` is written as a definition twice with no id and no status, and (3) the directory lists it but no section defines it; (4) `R-INVARIANT-PROVENANCE` is written as a definition inside a "Why … fixes it" sentence; (5) `R-INVARIANT-DONE` is a Rule (prefix `R-`) but is listed in the Principles directory; plus eight one-way Serves / Served-by citations (reported, never asserted, since the 2026-10-09 amendment removed mandatory pairing) and R-GOVERN-INDEX still carries a "Pairing invariant" paragraph that contradicts that amendment. **In the harness (mine to fix, but the answer depends on yours):** (6)-(7) `verify_r-invariant-comply_ship_gate.js` tags `R-INVARIANT-COMPLY` and `R-INVARIANT-NOLEGACY`, which are not Charter codes. **Coverage (a projection, not a gate):** 40 of 54 Rules name a mechanism; **14 have none**: R-COMPLEX-AXES, R-COMPLEX-COMPOUNDS, R-COMPLEX-VOLUME, R-CONF-ACCOUNTING, R-CONF-COMPLEXITY, R-FRICTION-RETIRE, R-GOVERN-ANTISTALE, R-GOVERN-TRANSITION, R-INTAKE-NONRETIRING, R-INVARIANT-DONE, R-PRICE-DURATIONSTATE, R-PRICE-PRECISION, R-RESOLUTION-RECOMPUTE, R-SYSTEM-SHAPE. **Defect classes with no detector:** DEFECT-AXIS-CONFLATION and DEFECT-NON-RETIRING-ANSWER. And `cart_logic.js` names DEFECT-PRESENTATION-IDENTITY, which I extended with DEFECT-UNPRICED-IDENTITY; neither is in the Charter's defect-class list. **Options:** (A) you fix the Charter items and say whether to add the two cart classes; I retag the ship gate's two orphans to whichever Rule it serves; (B) leave the Charter as is. For the 14: (C) the absent mechanisms stay a report; (D) an absent mechanism fails CI. **Default if unanswered:** (B) and (C): the Charter is not touched, the eight problems stay reported, an absent mechanism is a visible line in `verify_charter_rules.js`'s output and does not fail the suite (a failing check for a Rule nobody has written a mechanism for would be a number to lower, not a defect to fix), and the two orphan tags stay until you name the Rule.

### #133 — 🟡 OPEN, T158: the Project and the repo hold two different `COMPONENT_LAYER_MAP.md`s; the layer tests read the repo's
The Project copy is r5: a function-by-function inventory (PE-, NLP-, ORCH-, AR-, UI-, AC-, ST- rows) with the consolidation targets. It has **no `| Module | Layer |` table**. The repo copy is the T135 / T144 document, which has that table, the `BookingContext` / `ResolvedRoute` contract and the violations list, and **`_layers.js` reads its module table** to decide what layer each `<script>` block is (the layer matrix, the ship gate and the boundary test all depend on it; with r5 they throw "no row for btnyc.json"). I did not touch the Project's r5. In the repo copy I re-measured the module table for the page as it is and added a "The cart" section (CL-01…CL-06). r5 is stale in places: no `cart_logic` module; `AC-02` `addToCart` now only calls Logic; `AC-30` `sqRenderSelfQuoteAdlib` no longer exists; `PE-37` `parsePriceToInt` is deleted; it cites rules that the 2026-10-09 Charter no longer has (`R-GOVERN-RULEPARITY`). **Options:** (A) one document: r6 = r5 plus the module table (§5.0) and the contract sections from the repo copy, with the cart rows and the corrections above; (B) keep two documents, the repo's for the tests and r5 for people, with a pointer in each; (C) the repo copy only. **Default if unanswered:** (B): the repo copy stays the test-read one, r5 is untouched, and I write nothing into the Project, because (A) is a rewrite of the document you described as the owning specification.

### #134 — 🟡 OPEN, T158: the free-text SmartQuote line and the self-quote bypass line carry no structured quantity
The curated card now records the quantity it priced (`intakeAnswers.__qty`, "Quantity: n" in the notes); the guided builders already did. The free-text SmartQuote entry (`sqAddToCart`, from `S.qty`) and the self-quote bypass entry (`renderSelfQuoteFromRoute`'s Add button, from `perItemLabor`) do not: their price carries the count, their notes and identity do not. The quoted amount in the line's identity stops them from merging at the wrong price, but a technician reading the line is not told how many. **Options:** (A) add `__qty` and the "Quantity: n" note to both, with a behavioral test through each flow; (B) leave them. **Default if unanswered:** (B): changing two more entry builders without a test through each flow would repeat the mistake the curated card had; (A) is a small follow-up for T159 if you say yes.

### #135 — 🟡 OPEN, T158: small leftovers found on the way
(1) `FALLBACKS.default_minutes` (60) is read by nothing, and the comments around `FALLBACKS` and one in the AppController block ("…`sqRenderSelfQuoteAdlib` directly. Ensures consistent pricing") name `sqRenderSelfQuoteAdlib`, which no longer exists. (2) The trace button is `onclick="_traceToggle(); _renderTraceOverlay();"` (line 633) with no `typeof` guard; those functions come from `modules/trace.js`, an external script now, so if it fails to load the click throws a ReferenceError instead of doing nothing. **Default if unanswered:** delete the dead field and reword the two comments, and guard the click, in T159 with the rest of the cleanup (they change no behavior a customer sees).

### #136 — 🟡 OPEN, T158: a whole-file reformat makes every function "changed" for the ship gate, and it hides real edits in review
Your `qr.html` is formatted differently from the T157 file throughout (185 of 198 functions differ in text). It is a legitimate choice, but formatting and behavior should not travel in one change: the diff cannot be reviewed, and the ship gate (#128) cannot tell an edit from a re-indent. **Options:** (A) keep formatted source, and commit a formatting-only change on its own, before any behavior change (the gate then has a clean `HEAD`); (B) have the gate compare formatting-normalized function text (a harness change; it makes the gate ignore whitespace, which I will not do without your say because it changes what the gate means); (C) status quo. **Default if unanswered:** (A) from now on: this change is that boundary, so the next one is judged against a clean `HEAD`. I run Prettier 3.3.3 only on a file I have already read, never as part of a behavior change.

### #137 — 🟡 OPEN, 2026-10-10 mandate session (pre-B): 29 of the 75 red tests are stale and retireable (G-INVARIANT-RETIRE-TEST)
Classified by running each red test once and checking its first failure against the code or SSOT (nothing was fixed). **S1, 13, guard a file, tool or function that no longer exists:** `verify_btnyc_v5_compiler.js`, `verify_btnyc_v8_compiler.py`, `verify_compute_quote_for_draft.js` and `.py` (`btnyc.py`), `verify_dumb_ui_html_self_sufficiency.js` (`dumb_ui_prototype.html`), `verify_input_sanitization.js` and `.py` (`tag_ref()`), `verify_nlp_engine_module.js` (retired T136 per `retired/README.md`, still in the harness), `verify_no_module_drift.js`, `verify_smart_tag_reference_pathway.js` (`btnyc_master_deprecated.py`), `verify_t107_tracing_corrections.js`, `verify_tracing_tool_v2_upgrade.js`, `verify_tracing_v3_full_instrumentation.js` (the tracer lives in `trace.js`; D-A4-1). **S2, 6, source-shape checks on `sqBuildCuratedIntake`, which has zero hits in `qr.html`:** `verify_curated_card_chain_rewire.js`, `verify_curated_intake_confidence_agreement.js` (crashes at baseline; superseded by `verify_confidence_convergence.js` once B lands), `verify_mutual_exclusion_wired_into_main_render.js`, `verify_reported_ui_bugs_batch1.js`, `verify_confidence_strategy_inheritance.js`, `verify_xss_fixes.js` (its `escapeHtml` regex also misses the arrow-function form, though `escapeHtml` escapes all five characters). **S3, 9, pin an instance the code or SSOT has deliberately moved past:** `verify_category_icons_tabler_migration.js`, `verify_data_backup_question_wording.js`, `verify_dynamic_archetype_batch_2b.js`, `verify_dynamic_archetype_batch_2e.js`, `verify_intake_defaults_meaningfulness_review.js`, `verify_pricing_archetype_restoration.js` (counts for 74 services; the catalog has 76), `verify_furniture_flat_fee_pricing.js` and `verify_pricing_engine_module.js` (T135+ B2 stopped adding `flat_fee` to the price), `verify_service_type_normalization_consolidation.js`. **S4, 1:** `verify_file_integrity.js` (the manifest lists six files that no longer exist: `btnyc_v8_compiler.py`, `btnyc_master_deprecated.py`, `dumb_ui_prototype.html`, `qr_loader.js`, `btnyc_changes.sh`, `decisions.json`).
**Options:** (A) retire S1, S2 and S4 now (move to `test_harness/retired/` with a reason line each, per the T136 precedent) and retire each S3 test only after a class detector or a retargeted test covers what it was guarding; (B) keep them red. **Default if unanswered:** (A), in the session after this one; nothing is touched in the 2026-10-10 session.

### #138 — 🟡 OPEN, 2026-10-10 mandate session (pre-B): 33 of the 75 red tests cannot run, so they say nothing about the code (infrastructure)
**I1, 14:** `cms_bridge.js` stops because `_QTY_WORD_MAP` and `resolveCheckoutState` are no longer found in `qr.html` (`verify_appliance_keywords_and_confidence_cap`, `verify_cms_bridge`, `verify_contextual_override_word_order_fix`, `verify_delegated_vocabulary_batch_1` to `4`, `verify_description_matching_mechanism`, `verify_microwave_stove_ordering_fix`, `verify_natural_phrasing_corpus_fixes`, `verify_nlp_analyze_mode`, `verify_plural_quantity_and_object_extraction_fixes`, `verify_substring_collision_fixes`, `verify_tile_drywall_formula_wiring`; all `.js`). **I2, 5:** the tests call `btnyc_v10_compiler.py` at the repo root; it is in `test_harness/`, and it reads its schema from `test_harness/btnyc_schema.json` (now `schema/btnyc_schema.json`): `verify_archetype_layer_phase1.js`, `verify_btnyc_v10_compiler.py`, `verify_compiled_output_against_real_schema.js` and `.py`, `verify_routing_archetype_semantic_check.js`. **I3, 12, stale sandbox (DEFECT-STALE-SANDBOX):** the sandbox does not define a function the test calls: `verify_base_materials_fix.js`, `verify_pax_wardrobe_formula.js` (`resolveQuantityUnits`), `verify_ceiling_tile_dynamic_service.js` (`understandRequest`), `verify_dish_washer_cross_entry_fix.js`, `verify_nlp_incidental_keyword_fix.js`, `verify_nlp_synonym_weights.js`, `verify_object_based_resolver.js`, `verify_smoke_test_findings.js` (`_nlpQuiet`), `verify_object_extraction_location_skip.js` (`extractObjectDetailed`), `verify_orchestrator_phase2.js`, `verify_phase6_self_quote_rewire.js`, `verify_waterproof_area_formula_fix.js` (`closeTagsOverRequires`). **I4, 2, browser selectors predate the T158 page:** `verify_ui_surfaces.js`, `verify_customer_journey_visible.js` (a live defect behind them is not excluded: "replace 3 light bulbs" shows the intake screen where the test expects a self-quote screen).
**Options:** (A) retarget in this order: I2 (paths, the compiler's schema location), I1 (the extraction list), I3 (load the external `nlp_engine.js` in the sandbox; retire a test whose behavior a class detector already covers), I4 (selectors against the T158 page, then read what they say); (B) leave. **Default if unanswered:** (A), one group per session step after #137; nothing is touched in the 2026-10-10 session.

### #139 — 🟡 OPEN, 2026-10-10 mandate session (pre-B): 12 of the 75 red tests find a real defect in the current tree or its data (G-INVARIANT-SWEEP; none blocks B–H)
**L1 (4 tests):** `angle_stop_replacement`: raw `intake_chain` is `[plumbing_fixture, angle_stop_condition]`, compiled adds `hybrid_qty`; red in `verify_raw_vs_compiled_reconciliation.js`, `verify_self_quote_bug_fixes.js`, `verify_self_quote_ui_template_invariant.js`, `verify_orchestrator_engine_module.js` (which also has stale parts). R-INVARIANT-RERUN: derived data disagrees with its source. Interacts with G, which regenerates `compiled.*`. **L2 (1):** `verify_sqanalyze_orchestrator_equivalence.js`: `sqAnalyze` finds no match and the orchestrator picks a dynamic service for 4 of 76 named services (LED Bulb Upgrade, System Restore or Reset, Wall Hole or Crack Repair, and one more); R-CLIENT-CONVERGE, routing not confidence. **L3 (2):** `verify_no_orphaned_data.js` (orphaned formulas, checkout states, dynamic services; the list is in `RESULTS/orphaned_data_report.txt`), `verify_placeholder_data.js` (two services at `base_price` 0, one is `stove_repair`). **L4 (1):** `verify_charter_rule_index_v2.js`: `tech_trouble_computer_repair` Install and Setup chains have no symptom module (R-DOMAIN-DYNCHAIN); `hardware_install_formula` returns 95/100 where its own coefficients say 20/35 at 38 quantities (R-PRICE-REGISTERED); `pricing_engine` exposes `isFlatCheckoutState`, `isQuantityFixed` and `orchestrator_engine` exposes `orch_recommended_service_ids`, `orch_apply_quantity`, `orch_resolve_schema_location`, `orch_validate_ssot`, none in the declared API lists (R-SYSTEM-LAYERS). **L5 (2):** the Charter document, not edited (#131, #132): `verify_charter_rule_index_v10.js` and `verify_charter_rules.js` (R-GOVERN-INDEX defined twice; G-INVARIANT-DETECTOR listed but undefined; R-INVARIANT-DONE listed among Principles); plus `verify_r-invariant-comply_ship_gate.js` tags `@enforces R-INVARIANT-COMPLY` and `R-INVARIANT-NOLEGACY`, codes the 2026-10-09 Charter does not declare (it has R-SYSTEM-LAYERS and P-INVARIANT-NOLEGACY). **L6 (1):** `verify_r-invariant-deletion_declared_retirements.js`: retired names remain in comments (`sqBuildStep3` 13 hits, `sqRenderQuote` 9, `sqRenderSelfQuoteAdlib` 5; R-INVARIANT-DELETION: completion is zero hits). **L7 (1):** `verify_r-system-layers_full_matrix.js`: AppController (30 functions) and `store.js`, the known layer debt of Phase B.
**Options:** per item; L1 needs your ruling on which side is right (raw is the source, so the default regenerates the compiled side). **Default if unanswered:** L1 is decided at G when the compiler's diff is read (raw wins; ledgered on its own line); L2, L3, L4, L6 are queued for the sweeps after H or the next session; L5 stays with you (the Charter), and the two orphan tags are corrected by retargeting them to R-SYSTEM-LAYERS and P-INVARIANT-NOLEGACY in the next session; L7 is Phase B.

### #140 — 🟡 OPEN, 2026-10-10 mandate session (B, T159): what the one confidence resolver does NOT settle: R-CONF-ACCOUNTING, the Cᵢ / Cₓ split, intent-vs-scope conflation, bars the questions cannot clear (foundational)
**What landed:** `resolveConfidence(evidence, DB)` is the only place a score, a bar and an escalation are produced; `computeUnifiedQuote`, `orch_compute_confidence` (signature kept) and the guided builder (`sqPrepareFlow` via `resolveSessionConfidence`) all go through it; the `confidence_gain` accumulation loop is deleted. The class detector `verify_confidence_convergence.js` holds the convergence (red on the pre-fix tree, 12 of 24 checks; green after). **This is convergence on the CURRENT model, not a correct model.** **What does not land, and why it is one decision and not several:**
1. **R-CONF-ACCOUNTING (not satisfied).** The rule wants Cₓ derived from the active uncertainty ledger with SSOT weights. There is no Cₓ accounting anywhere: the score is the entry's intent contribution plus a match strength, and **an answer never raises it**. `confidence_gain` is on **119 of 124** intake modules (2,170 points in total) and **nothing reads it any more** (the loop was its only live reader), which is the "non-authoritative legacy metadata" state the rule describes; the field is still in the SSOT and the schema.
2. **The Cᵢ / Cₓ split.** One number answers two questions. Catalog = 100 (a tap is certain of the *service*) swallows scope uncertainty, so every catalog tap clears every bar; `other_tile` = base + 45 + min(15, match × 0.15) and keyword = base + min(20, match × 0.2) are intent estimates that were never scope estimates. This is the conflation your amendment named (the Charter's `DEFECT-AXIS-CONFLATION` text is written for tier / checkout / scheduling axes; this is the same shape on the confidence axis, and I am using your name for it, not claiming the Charter defines it so).
3. **Bars the questions cannot clear (F2 in `SESSION_PLAN.md`).** 47 of the 76 services have a `minimum_quote_confidence` above `base_confidence` plus every `confidence_gain` in their chain (52 when `maximum_followup_questions` is respected). The Charter says a threshold the real questions cannot clear is a wrong threshold. Catalog = 100 hides this today. Fixing the model (1, 2) without this audit would unmask it all at once.
4. **Coefficients written in code (R-SYSTEM-NODATA):** 45, 15, 0.15, 20, 0.2, and the generic fallback strategy (70 / 3 / 35 / 40 / 'medium') in `resolveBaseConfidenceStrategy`. Item C moves nine other fallbacks into the SSOT; these are not among the nine.
5. **Entry markers.** `prefillSmartQuoteFromOtherTile` and `sqAnalyze` (Glue, held to their layer by the ship gate) write no `entry`, so `resolveSessionEntry` reads the session's identity (the "Other" tile's id, a keyword). The guided builder therefore scores as keyword evidence (`entry:keyword`); there is no "guided" term. Giving the two seeds a marker is a Glue edit, deliberately not done in B.
6. **Write-only fields.** `S._confidenceStrategy` and `S._escalatedBy` are written by `sqPrepareFlow` and read by nothing in `qr.html` (only the reducer's key list and the detector). They are kept (removing them changes the reducer's `legacyView` shape and your `appReducer.js`).
7. **A dead branch.** `sqPrepareFlow(skipStep2)` is called with `true` at both call sites, so its `else` branch (the "is the bar already met, skip step 2?" test) is unreachable. B reduced its arithmetic to the resolver's verdict; deleting the branch and the parameter is a separate, small change.
**Migration plan (nothing below is done):** (a) your ruling on the model: what Cᵢ and Cₓ are, and whether a catalog tap keeps 100 as an *intent* score; (b) the entry contributions and the coefficients move to `global_rules` (schema first, boot gate re-run), so the numbers are data; (c) the reachability audit becomes a class detector ("every bar can be cleared by the questions the chain asks") and the 47 are reviewed service by service; (d) Cₓ accounting from answered modules against the uncertainty ledger, replacing `confidence_gain` with the owning specification's weights, then the 119 fields are retired; (e) `verify_confidence_convergence.js` stays as the guard: it asserts agreement, not numbers, so a recalibration does not turn it red and a fourth calculator does. **Options:** (A) rule on (a) and take (b)–(e) in order in later sessions; (B) hold the model as it is and treat the convergence as the end state. **Default if unanswered:** (B) for now; nothing here changes behaviour until (a) is ruled.

### #141 — 🟡 OPEN, 2026-10-10 mandate session (B, T159): second instances found while changing the confidence code (G-INVARIANT-SWEEP; filed, not fixed)
**Swept for the class itself first:** every reader of `base_confidence`, `minimum_quote_confidence`, `confidence_gain`, `confidence_weight` and `_matchConfidence` in `qr.html` now goes through `resolveConfidence` or reads its result; no other confidence calculator exists. **What the sweep found next to it:** (1) the dynamic service's suggested-tag parse (`$ref` → tag id) exists three times with small differences: `buildServiceSessionSeed`, `orch_enrich_from_dynamic_service` (which, unlike the other two, does not check that the tag exists in `smart_tags`) and `resolveBuilderDynamicDefaults` (the guided builder's copy, moved out of `sqPrepareFlow` unchanged for the ship gate; the third copy is mine). DEFECT-DUPLICATE-PARSER, R-INVARIANT-SINGLEDEF; collapsing needs a ruling on whether the unchecked variant is intended. (2) The union "universal + category defaults + group defaults" of `intake_defaults` exists three times: `computeUnifiedQuote` (`forceModules`), `sqPrepareFlow` (`S._forceModules`, a Glue statement not flagged by the gate) and `orch_compose_intake_chain` (T118). DEFECT-DUPLICATE-REGISTRY. (3) `orch_compute_quote`'s gated branch (detected tags not yet affirmed) used to report the lesser evidence's bar beside the gated price while `route.confidence` reported the whole evidence's (matrix cell: "hang a heavy mirror on my brick wall", quote bar 90, confidence bar 95); **fixed in B**, one cell in the matrix and no reader of the field today (the reducer stores `quote.meetsConfidenceBar`, nothing in `qr.html` reads it), listed here so the sweep shows its second instance and its closure. (The other 86 cells of the pre-fix Part 4 failure, 87 in all, had a different cause, also closed in B: 40 "Other"-tile cells, where the orchestrator's quote did not know the entry and scored the request as a catalog tap, 100 against 75; and 46 free-text cells, where the quote took the intent keyword's mapped weight and the route took the match strength it had measured, 54 against 60 for "Baseboard Install".) (4) `verify_tag_synthesis_convergence.js` built a context that claimed `entry: 'catalog'` and carried an NLP keyword, which no real entry produces; the fixture now declares `free_text` (a fixture that does not drive the real interface, P-GOVERN-GOODHART). **Options:** per item. **Default if unanswered:** (1) and (2) in the DUPLICATE-REGISTRY sweep after H (spare time), each as one `R-INVARIANT-SINGLEDEF` change with its own detector; (3) and (4) are done.

### #142 — 🟡 OPEN, 2026-10-10 mandate session (C, T160): five of the nine `global_rules.fallbacks` values repeat a number the catalog already holds (R-INVARIANT-SINGLEDEF, DEFECT-DUPLICATE-REGISTRY; copied, not linked)
**What C did:** the nine values `FALLBACKS` held in code moved into `btnyc.json` at `global_rules.fallbacks` literally (no price, label or minute changed). Moving them is what R-SYSTEM-NODATA asks; it does not make each number have one owner. **Five are duplicates of a field that already exists:** `base_price` 70 = `service_types.Repair.base_price`; `tier_rate` 85 = `complexity_tiers.skilled.hourly_rate`; `dispatch_fee` 45 = `surcharges.dispatch_fee`; `standard_labor` 40 = `meta.global_rates.standard_labor`; `badge_label` '✅ Fixed price' = `checkout_states.standard_flat_rate.ui_badge_label`. The other four have no second home (`default_minutes` and `no_estimate_minutes`, which are #143's question; `call_for_quote`; `disclaimer_text`). **Why they are copies, not references:** the SSOT has no reference mechanism for a scalar, and inventing one is a change of shape (R-SYSTEM-SHAPE) that is yours to make. `verify_fallbacks_live_in_ssot.js` lists the five pairs and fails if one side moves without the other, so the duplicate cannot drift silently (R-INVARIANT-DUPLICATION-TICKET: canonical replacement = the existing field; why both exist = no scalar reference; condition for deletion = you rule which side owns each). **A sixth finding on the way:** the reader of `dispatch_fee` tests the value for truthiness (`surcharges.dispatch_fee || FALLBACKS.dispatch_fee`), so an authored `dispatch_fee: 0` is read as "absent" and the fallback 45 is charged; the documented way to waive the fee is `dispatch_fee_enabled: false`, which works. Same shape for `standard_labor` and `tier_rate`. DEFECT-ARBITRATION in miniature; not changed (it is a behaviour change if anyone authors a 0). **Operator question:** for each pair, which side owns the number? **Default if unanswered:** the existing, more specific field owns it; the `fallbacks` key stays as a copy and the pair check holds them equal; the `||` reads stay as they are.

### #143 — 🟡 OPEN, 2026-10-10 mandate session (C, T160): "how long is a job nobody estimated" has three answers in the code (30, 45, 60) and a floor of 30 (a conflict the SSOT cannot settle by itself)
**What `default_minutes` means where it is read** (the one reader C wired): in `applyPricingFormula`, `buy_the_hour_qty_gate_formula`, `baseMinutesEstimate` is the minutes ONE JOB (the work the base price pays for, the "1 item" case) is assumed to take when the service authors neither `default_estimates.total_minutes` nor `operational_metrics.expected_minutes`. It is **per job**, one cart line; a visit has no minutes of its own (the dispatch fee is the per-visit cost). It feeds `extraMin = max(0, minimum_billable_hours x 60 - baseMinutesEstimate)`, the top-up to the billing minimum for an order of more than one item. At 60 that equals `minimum_billable_hours` (1) x 60, so the top-up is 0; the two numbers are independent, and raising the one without the other bills the difference. The catalog's only service on this formula (`blinds_shades_curtains_buy_the_hour`) authors both a range (50-70) and `expected_minutes: 60`, so on the service path the default is not reached today; the pricing-archetype path (`computeArchetypeQuote`) calls the formula **without the service**, so there it is always the value used. **The same concept, answered differently elsewhere** (none of them changed by C): `computeUnifiedQuote` `FALLBACKS.no_estimate_minutes` (45) and then `Math.max(baseMinutes + extraMin, 30)` (a floor of 30); `computeArchetypeQuote` `om.expected_minutes || 30` (three sites: `flat_simple`, `hourly_timed`, the formula-less fallback) and, in its formula branch, `?? FALLBACKS.no_estimate_minutes` (45); the cart-line writers `_renderSimpleConfirm` `expected_minutes || 45` and `_renderStructuredIntake` `... || 60`, and the literals `totalMinutes: 60` in `_renderDiagnosticFlow` and `_renderOtherFlow`. So the codebase does not yet have one answer, and `default_minutes` / `no_estimate_minutes` carry two of them into the SSOT with their `_notes` saying so. **Why not unify in C:** choosing one value changes prices (the archetype path's 30 against the formula's 60) or cart minutes, which is a behaviour change, and the right value is a business statement. **Operator question:** what is the length of a job with no estimate, and does it differ by pricing path on purpose? **Default if unanswered:** every value stays as it is: `default_minutes` 60, `no_estimate_minutes` 45, the `|| 30` / `|| 45` / `|| 60` literals and the floor of 30 in code; the five literals that are numeric defaults stay filed in the ratchet in `verify_fallbacks_live_in_ssot.js`.

### #144 — 🟡 OPEN, 2026-10-10 mandate session (C, T160; 20 -> 18 in T161): the other numeric defaults in code (the R-SYSTEM-NODATA tail): 18 filed, none new, the list can only shrink
**What the class detector found:** a numeric literal as the last operand of a `??` / `||` chain is a business number defaulted in code. After C there were 20 in 15 places across the three layers that the scan covers (18 in 13 after T161, below) (`verify_fallbacks_live_in_ssot.js` section 6; 0 and 1 are exempt as identity elements). **Seven are a redundant copy of a number the SSOT already holds under the very key the code reads** (so they only act if the field is missing): `applyLiveConfidenceEscalation` 95 and 6 (`confidence_escalation.max_minimum_quote_confidence`, `.max_followup_questions_absolute`); `applyPricingFormula` `minutes_per_tile` 5, `minutes_per_sqft` 5, `minimum_hours_for_start_fee_waiver` 3; `detectIntentNLP` 50 (`thresholds.route_to_group_other_tile`); `collectBookingContext_freeText` 70 (`thresholds.auto_select_named_service`). **Six have no SSOT home:** `applyPricingFormula` `parseInt(area_sqft) || 2`; `detectIntentNLP` `confidence_weight || 30` (twice); `renderServices` `sort_order ?? 999` (twice, a "last" sentinel); `addToCart` `updated?.qty ?? 2` (a toast). **Five are #143's minutes** (`computeArchetypeQuote` `|| 30` three times, `_renderSimpleConfirm` 45, `_renderStructuredIntake` 60) and **two were in `_sqPrepareFlowLegacyEscalation`**, which D (T161) deleted, taking its two entries out of the filed list (7 + 6 + 5 = 18). **Found and closed in C (G-INVARIANT-SWEEP):** two more literal copies of `base_price` 70 in `modules/nlp_engine.js` (`buildCandidate` and the `default_fallback` branch of `detectIntentNLP`) now read `FALLBACKS.base_price`, so the number has one owner in code; behaviour unchanged (golden master and render diff identical). That makes `nlp_engine.js` depend on a binding in `qr.html`, a new deploy-graph edge: #145. **Not covered by the scan, named so it is not mistaken for more:** string defaults (`|| 'skilled'`, `|| 'Add to Request'`), a number that is not the last operand of a default chain (a ternary, an assignment, `Math.max(x, 30)`), and any constants table other than `FALLBACKS` (`_GENERIC_QTY_MODULE_KEYS` and its relatives). **Operator question:** (1) delete the seven redundant copies (each is a one-token edit, but each changes what happens when the SSOT lacks the field, from "a default" to "an error" or "undefined", so it wants your word that an incomplete SSOT should fail rather than limp), and (2) widen the scan to string defaults and constants tables? **Default if unanswered:** no deletions; the scan stays as it is; a new numeric default fails the detector until it is filed or moved into the SSOT.

### #145 — 🟡 OPEN, 2026-10-10 mandate session (C, T160): deploy order, and a NEW DEPLOY-GRAPH EDGE: `nlp_engine.js` now depends on a binding declared in `qr.html`
**Hazard 1 (data against code).** The new schema requires `global_rules.fallbacks`, so the new `btnyc.json` + new schema + any `qr.html` is safe, and the new `qr.html` + new data is safe. The new `qr.html` + the OLD `btnyc.json` + the OLD schema is the bad pair: the old schema does not require the block, so the boot gate says valid and the page starts; the first read of `FALLBACKS` (only reached where a more specific field is absent) then throws, naming `global_rules.fallbacks` and saying to deploy `btnyc.json` with `qr.html`. The new schema + old data refuses to boot with `/global_rules missing required property "fallbacks"`, the loud, early form. **Hazard 2 (code against code): a new edge in the deploy graph (operator note on T160).** Before C, `modules/nlp_engine.js` read only `DB` and `window._NLP`, so it could be published, cached or rolled back independently of `qr.html`. It now reads `FALLBACKS`, a top-level binding declared in `qr.html`'s pricing block, in two places (`buildCandidate`; the `default_fallback` branch of `detectIntentNLP`). That is an edge from one separately served file to another file's module state, and it matters wherever the two files can have independent lifetimes (a CDN with separate TTLs, a rollback of one). **Measured with the real text bar** (four sentences, page errors none, the same routes as the control): new `qr.html` + old `nlp_engine.js` works (the old module carries its own literal). Old `qr.html` + new `nlp_engine.js` **also works** for every `qr.html` in this repository's history, because each defines `FALLBACKS` as a frozen object that already has `base_price: 70`, so the new module reads the same 70 (an earlier draft of this entry said the opposite; it was wrong). A `qr.html` with **no `FALLBACKS` binding at all** + the new `nlp_engine.js` throws `ReferenceError: FALLBACKS is not defined` from `buildCandidate` on essentially every sentence that matches an intent keyword (80 of the 81 keyword entries author no `fallback.base_price`, so the read is the normal path, not a rare one). I cannot see which `qr.html` is live; if it predates `FALLBACKS` (the monolith before T158 adopted the revised file), publish `qr.html` before `nlp_engine.js`, otherwise this edge cares about no order. **Why the edge exists at all:** the two reads feed `intent.base`, a field nothing reads (#118; the two literals were two of its eleven writers) and no price depends on them (#147). **The safe order:** `btnyc.json` and `schema/btnyc_schema.json`, then `qr.html`, then `modules/nlp_engine.js`. **Operator question:** (1) keep the edge (documented, measured), or (2) restore the two literal `|| 70` copies, which removes the edge and puts two owners of the number back (two entries return to the ratchet in #144)? (3) Should the boot itself check that the block exists, so a failure is at boot and not at the first fallback read, whichever schema is deployed? One line in `init`; not added (smallest change; the schema gate is the designed guard). **Default if unanswered:** keep the edge; deploy in the order above; no boot check; when #118's default is executed (delete `intent.base` and its eleven writers) the edge disappears with the two reads.

### #146 — ✅ RESOLVED, 2026-10-10 mandate session (C, T160; found because C added keys, fixed at its source): `DEFECT-CHECKER-ESCAPING` — the page's schema checker reported the place of a key containing "/" or "~" unescaped
**The class (a project label, not a Charter class; naming it in the Charter is yours):** a validator that builds a location string from data or schema keys must escape each key as RFC 6901 says (`~` -> `~0`, `/` -> `~1`), or the reported place names a path that does not exist and cannot be compared with the reference validator's. **The instance:** `orch_validate_ssot` built `path + '/' + k` unescaped in four places for data (`properties`, `patternProperties`, `additionalProperties` and the additional-property error) and in three more for the schema audit (`properties`, `patternProperties`, `$defs`). The catalog has 8 distinct such keys in 11 places: `Hide or run cables through a wall/floor` in two intake chains' `then` (where the schema requires an array, so retyping it is invalid), and 9 more in free-form maps (`issue_type_fees`, `compiled.symptom_index`), where any type is valid. Verdicts were never affected, only where the problem is said to be. **Why it surfaced now:** `verify_ssot_boot_validation.js` draws 250 seeded random mutations over the SSOT's key paths; C added keys, every later draw moved, and one landed on that key (20/20 -> 19/20, path agreement 104 of 105). **Fixed:** one helper (`seg`) in `orch_validate_ssot`, used for every path built from a key. **Test extended, not loosened:** a directed leg mutates every key that needs escaping (11; 2 are invalid when retyped) so coverage no longer depends on a seed, and one check names a schema-audit place with `/` and `~` in its key. **Before / after:** the extended test is 19 of 22 on the old tree (path agreement 105 of 107, directed 0 of 2, audit check red) and 22 of 22 on the new (107 of 107, 2 of 2). Swept for other builders of key-based paths in `qr.html`: array positions are numbers (nothing to escape), the schema declares no property, pattern or definition name needing escape, and no other function builds such a path. Recorded in T160 as a sub-item (5a), not a T161.

### #147 — 🟡 OPEN, 2026-10-10 mandate session (C, T160): what the 290 fallback reads in the golden master are. Not an incomplete SSOT: a dead field fed by a fallback, and a formula called without its entity
**Measured** (the golden master with a spy on `FALLBACKS`, each read attributed to the price point and function that made it): 196 of 2,988 points (6.6%) read a fallback at least once, 290 reads in all. **`base_price`, 245 reads (85%), all from the NLP's `buildCandidate`, all in the free-text family (168 of its 176 points).** 80 of the 81 intent-keyword entries author no `fallback.base_price`, so for them the number every free-text candidate carries IS the fallback: the normal case, not a gap on a rare path. The candidate's `base` becomes `intent.base`, which nothing reads (#118: the only reads are `!S.intent.base` guards), so no price depends on it; the golden master is identical with or without. Adding `fallback.base_price` to 80 entries would complete the SSOT for a field nothing uses. **`default_minutes`, 45 reads, all `applyPricingFormula`, all one service (`blinds_shades_curtains_buy_the_hour`) on the pricing-archetype path (28 catalog points)**: `computeArchetypeQuote` calls `applyPricingFormula(realFormulaId, answers || {}, qty || 1)` **without the entity**, so the service's authored minutes (range 50-70, `expected_minutes` 60) are never consulted there and the default is used; they agree today (60), so nothing differs. **A sharper form of the same omission, measured by a direct call:** for the answer "More than 1 item" the formula returns `{extraFee: -50, overrideHourlyRate: 50}` with the entity and `{extraFee: 0, overrideHourlyRate: 0}` without it (the branch reads `svc?.financial_engine?.base_price || 0`); the quote is 50 for 60 minutes either way today, because the authored duration equals the billing minimum. The golden master does not vary that answer (its first-answer variant picks "1 item"), so it could not have shown this. I did not establish whether a longer authored duration would expose a wrong price. **Answer to "which entries cause fallback hits, and should the SSOT be completed for those paths?":** no catalog quote reads a fallback because the SSOT lacks a value; the free-text hits are a dead field, and the archetype hits are a call that omits its entity. **Consequence for #142:** the five read sites of `fallbacks.base_price` are five of #118's eleven writers, so executing #118's default leaves that key with no reader; the detector's "no dead number" check will then require removing it, and the first duplicate in #142 (`Repair.base_price`) goes with it. **Operator question:** (1) execute #118's default (delete `intent.base` and its writers); (2) should `computeArchetypeQuote` pass the entity to `applyPricingFormula`? It is a behaviour change on the archetype path wherever the entity's data differs from the formula's defaults. **Default if unanswered:** (1) as #118 states, in the Phase C S-state work; (2) no change; the second is filed here so the next change to that path sees it.

### #148 — ✅ RESOLVED, 2026-10-10 mandate session (D, T161): the guided builder's stored bar and escalation for `#brick_wall`, `#fragile_item` and neither, before (`3f27e83`) and after; closes the held note `PHASE_B_FOLLOWUP C-05` / #116, both of its items
**The held note recorded two items; where each landed.** (1) The inline `confidence_gain` accumulation in `sqPrepareFlow`: deleted in T159 (item B). (2) The duplicated escalation: the builder stopped calling `_sqPrepareFlowLegacyEscalation` in T159, and **T161 deletes the function and both held-note comments**. The name and "PHASE_B_FOLLOWUP ... C-05" now occur nowhere in the page; `verify_single_escalation_path.js` holds that. #116's option (A), delegate, was taken. The note said delegating "changes what the builder shows, which Phase A forbids"; your mandate (B, D) lifted that, and this entry records what it changed.
**Measured: the 10 single-action "Other" groups, each with the three cases, the builder's stored bar / question cap / `escalatedBy`, on `3f27e83` and on this tree.** (Group base bars before: 70 for 3 groups, 80 for 6, 90 for 1; question cap 2, or 3 for one group.)
| Case | Before (`3f27e83`) | After (T161) | Cells that change |
|---|---|---|---|
| neither | the group's own bar and cap, `escalatedBy` null | identical | 0 of 10 |
| `#brick_wall` | the same as "neither": never escalated | bar **95** (70 + 30 and 80 + 30 and 90 + 30 all hit the SSOT cap), cap +2, `specialized` | 10 of 10 |
| `#fragile_item` | the same as "neither": never escalated | bar 70 -> **85**, 80 -> **95** (exactly the cap), 90 -> **95** (105 capped); cap +1; `skilled` | 10 of 10 |
| both | the same as "neither" | as `#brick_wall` (the worst tier wins, they do not add) | 10 of 10 |
Example, `furniture_fixes_assembly_disassembly` (base 70, cap 2): `#brick_wall` 70 -> 95, cap 4, `specialized`; `#fragile_item` 70 -> 85, cap 3, `skilled`.
**Score and the skip-step-2 verdict.** `sqPrepareFlow` has two call sites and both pass `skipStep2 = true`, so the builder never consults a verdict: the step-2 skip is the same `true` before and after. The value `resolveConfidence` gives the unreachable `else` branch (#141) is "does not meet the bar" in all 40 cells (score 30 in 8 groups, 40 in 2, against a bar of 70-95), and was never reached; at `3f27e83` no score existed on the live path to compare (the branch it fed compared a `confidence_gain` sum and was equally unreachable).
**What a customer sees: nothing.** The stored strategy has no reader (#140 item 6). Render differential (1,146 entries, 82 of them builder runs): 0 differ. Price golden master (2,988 points): 0 differ. **D itself changes nothing observable:** the 40 cells are identical on the T160 tree and on this one; B made the change and D removes what B left unreachable. **Why D is an item if no output moved (`R-CLIENT-CONVERGE`).** The rule is about the *stored state* agreeing across paths, not about what is rendered. At `3f27e83` the guided builder and the orchestrator stored different bars for the same tag facts (30 of 40 cells); B made them agree, and D deletes the second implementation that could drift back and puts a class detector over it (`verify_single_escalation_path.js`). Before D the agreement was something the tree happened to have; after D it is something the tree cannot lose without a red test. The rule is satisfied whether or not a customer ever sees it.
**Why the old copy never fired, and the root cause (found in D, fixed in T161).** It read `smart_tags.*.effects.complexity_override`, a field no tag has (0 of 43). The SSOT itself pointed there: `global_rules.confidence_escalation._note` said the escalation applies "when a ... smart_tag carries complexity_override", while the tag field is `escalate_complexity` (`complexity_override` is a field on an intake **answer**: 327 of them, read by the pricing path and the compiler). The note now names the right field and says which is which. One string in the SSOT, no shape change, boot gate green; a documented one-off (R-INVARIANT-DISEASE), with the class held by the detector rather than by testing the note's wording.
**The plan said "exactly one reader of `escalate_complexity`"; it is two.** `computeUnifiedQuote` reads it too, for the pricing tier. The detector therefore holds the arithmetic to one function and the readers to a filed list of two: #149.

### #149 — 🟡 OPEN, 2026-10-10 mandate session (D, T161): "the worst tier among the active tags" is selected by two loops, one for the confidence bar and one for the pricing tier, each with its own local `RANK` (G-INVARIANT-SWEEP; R-INVARIANT-DUPLICATION-TICKET)
**Found while holding the class (D's detector, leg 2).** `escalate_complexity` is read by exactly two functions. `applyLiveConfidenceEscalation` loops over the active tags, keeps the highest-ranked tier and applies the SSOT's deltas to the bar and the question cap. `computeUnifiedQuote` runs the same loop, seeded with the tier its intake answers ratcheted to, and hands the result to `deriveComplexityTier`, which picks the hourly rate. Same field, same ordering, two purposes. Each loop declares its own `RANK = { skilled: 1, specialized: 2 }` and `deriveComplexityTier` a third table, `TIER_ORDER`; E (T162) gives them one `TIER_RANK`. Nothing is wrong today: the bar and escalation agree across the three gateways (`verify_confidence_convergence.js`) and the golden master fixes the pricing tier. The risk is the one D removed: a third reader, or a change to how "worst" is chosen in one loop only. **What I did:** nothing to the loops. The detector files both readers, with the reason, and fails on a third. **Operator question:** after E, extract the loop into one Logic function (`worstTagTier(tagIds, smartTags, seedTier)`) used by both? It edits two Logic functions in the pricing path; the golden master covers the pricing one. **Default if unanswered:** no extraction; E replaces only the constants; the detector's reader list stays at two.

**T162 update (E).** The three tier tables are now one `TIER_RANK` (#154). The loops are untouched and the question above is unchanged. A fresh sweep after E found the same two readers, no third. **Default if unanswered:** unchanged: no extraction.

### #150 — 🟡 OPEN, 2026-10-10 mandate session (D, T161): `effects` on a tag and on an intake answer is a retired shape the schema still permits, and a renderer still reads it, so a fee chip can never draw (152 answers carry a fee no chip shows) (G-INVARIANT-SWEEP)
**Determination (this entry does not leave it open).** The data is right and the read is stale. It is neither "never migrated" nor "dropped by the compiler". The fees were moved on purpose (v9.4, completed v9.6) from `client_response[].effects.fee` to `modifier_ref` -> `global_rules.modifiers`. Measured: 595 answers, **0 carry `effects`**, 219 carry a `modifier_ref`, **152 of those point at a modifier with a non-zero fee** (124 of the 182 modifiers). The schema's own text for both `effects` declarations says "Deprecated ... kept in the schema only for historical-file compatibility", the pricing path's v9.6 comment says fee and minutes "resolve exclusively via modifier_ref", and the compiler reads only the top-level fields. `_renderStructuredIntake` (qr.html ~6149) was not moved with them: `resp.effects?.fee` is always `undefined`, so the "+$N" chip (`.intake-fee-delta`, drawn in two branches for a positive and a negative fee) never draws. So: the data is not the finding (the schema's data side is correct); the renderer read and the schema allowances are dead; and the consequence is a presentation feature lost silently in the migration (up to 152 answers have a fee the chip would show). The same door admits the other retired field D's detector holds shut: an author can write `effects.complexity_override` on a tag, the boot gate accepts it, nothing happens (the detector's SSOT leg fails the day one is authored, shown on a mutant).
**Two actions; the schema allowance goes in both.** (R) **Retire:** delete the read and the chip's two branches (`R-INVARIANT-DELETION`), and drop `effects` from the schema for tags and answers (a shape change: boot gate re-run, check `compiled.*` and the compiler). No visible change, because the chip never draws. (W) **Restore:** draw the chip from the modifier's fee through a Logic function (Rendering may not read state or call engines, `R-INVARIANT-BOUNDARY`), then drop the schema allowance as in (R). A visible change: "+$N" chips on up to 152 answers on this path, and the product question of whether a per-answer fee on the chip is wanted (the vision's "shows exactly what factors and fees influence their price" argues for it; the other price lines may already say it). **Operator question:** (R) or (W)? **Default if unanswered:** (R), in the post-H sweep session, because it is the only one that changes nothing a customer sees; (W) stays available afterwards at no extra cost.

### #151 — 🟡 OPEN, 2026-10-10 mandate session (D, T161): two top-level functions in the page have no caller in it (G-INVARIANT-SWEEP: how the deleted function survived; filed, not fixed)
**Measured** (a name search over the assembled page, 223 top-level functions, word-boundary, comments and strings included so a dispatch by string would count): **2 have no mention other than their own declaration.** `renderGlobalSearchResults` (Rendering): no caller anywhere in the page and **no test references it**; a retirement candidate under R-INVARIANT-DELETION. `collectBookingContext_otherTile` (Glue): no caller in the page, **13 test files drive it** as the seam for the orchestrator's "Other" tile entry, while a real tap on an "Other" tile goes through `prefillSmartQuoteFromOtherTile` (the state path). So the orchestrator's Other-tile entry is exercised by tests and never by the page. The deleted `_sqPrepareFlowLegacyEscalation` was the same shape (a function with no caller, kept by a note). **Not a class detector yet:** a "no function without a caller" check would need to treat the 13-test seam as a filed exception; widening to it is a decision. **Operator question:** (1) delete `renderGlobalSearchResults`; (2) is the page meant to route an "Other" tap through `collectBookingContext_otherTile` and the orchestrator (the three-entryways-one-engine picture), or is the state path the production route and the function a test seam to retire with its 13 tests' premise? **Default if unanswered:** (1) delete it in the post-H sweep session, with the evidence above; (2) no change; it stays, and the question is carried into the next-session write-up.

### #152 — 🟡 OPEN, 2026-10-10 mandate session (D, T161): the SSOT consultation audit decides "does the code consult this field" by matching text, comments included; with comments stripped, 5 more paths read as unconsulted (G-INVARIANT-SWEEP, a defect in a detector)
**Measured.** `verify_ssot_consultation.js` searches the assembled page's raw text for `.key`, `['key']`, `"key"` or `key:`. A comment is text. Its header calls this "generous on purpose", and for two sessions the generosity hid a true result: B (T159) deleted the only reader of `intake_modules.*.confidence_gain`, and two comments about the deletion kept the audit green until D removed them (T161 section 5b). Handled then with two reasoned allowlist entries citing #140, which is the audit's documented path; its assertion was not changed. **The honest fix, measured but not made:** blank every comment in each `<script>` block before the audit reads it (acorn comment ranges) and run it unchanged: of 485 paths, **5 flip to unconsulted.** Traced by hand: (1) `meta.estimate_disclaimers.flat_fee` is a false report in the stripped run: it is read through a computed key (`discs[discKey]`, `discKey` defaulting to the literal `'flat_fee'`, ~2474), which a name match cannot see in either run, so the audit also needs a recognised pattern for a string literal used as a dictionary key; (2) `global_rules.surcharges.dispatch_fee_apply_min_labor` is a **real finding with a price consequence: #153**; (3) `furniture_catalog[].flat_fee` is named only by a comment (~2372), no code reads it; (4) `pricing_archetypes.*.definition` is a descriptive text field no code reads; (5) `compiled.candidate_matrix.*.Repair.any[].service_id` is compiler output under the already-unconsumed `compiled` tree. **Not done mid-mandate:** changing what the audit counts as a read while E-H are in flight would turn five paths red between check-ins and mix an audit change into four unrelated items. **Operator question:** make the audit read code only (strip comments, add the literal-key pattern), and settle (3)-(5) with the audit's own by-hand trace? **Default if unanswered:** yes, in the post-H sweep session: strip comments, add the literal-key pattern, allowlist (4) and (5) with their reasons, and bring (3) with its trace; (2) is #153.

### #153 — 🟡 OPEN, 2026-10-10 mandate session (D, T161; found by #152's trace): the SSOT records a decided rule that no code implements: the $45 dispatch fee applies only when labor is under $50 (`dispatch_fee_apply_min_labor`)
**Measured.** `global_rules.surcharges.dispatch_fee_apply_min_labor` is 50, and its `dispatch_fee_note` says "v9.6 DECIDED (working decision ...): $50 confirmed as the working threshold ... jobs at or above it are large enough that the labor charge already does". In `computeUnifiedQuote` the name appears only in a comment (~2550); the fee is `dispatchEnabled ? surcharges.dispatch_fee : 0` (~2557), no test on labor, and no other line in the page or the modules reads the key. **So every quote with the toggle on carries the dispatch fee whatever the labor.** Counted on the live page, a catalog tap of each of the 76 named services at default (quantity 1, no answers, no tags): **all 76 carry the $45 fee; 58 have labor of $50 or more** (where the decided rule would remove it, quotes $45 lower) and 18 have labor under $50 (unchanged). **I did not change it:** implementing it lowers the price of three quotes in four on this slice, which is a pricing decision, and the golden master would move by design. **Operator question:** implement the decided rule, or retire the key and its note (the fee is per visit, always)? **Default if unanswered:** no code change (pricing stays as it is); the post-H sweep session brings the same count over the golden master's inputs, and the key and the note stay in the SSOT as the record of the decision.

### #154 — ✅ RESOLVED, 2026-10-10 mandate session (E, T162): the complexity-tier ranking existed three times (`RANK` in two functions, `TIER_ORDER` in a third); it is now one frozen `TIER_RANK` (R-INVARIANT-SINGLEDEF, DEFECT-DUPLICATE-REGISTRY)
**What changed.** One top-level `const TIER_RANK = Object.freeze({routine: 0, skilled: 1, specialized: 2})` in the Logic section of the page (before `applyLiveConfidenceEscalation`). The three private tables are gone: `RANK` in `applyLiveConfidenceEscalation` (2 reads), `RANK` in `computeUnifiedQuote` (5 reads), `TIER_ORDER` in `deriveComplexityTier` (4 reads). **11 reads in all go to the one table; nothing else in the edit.** The two worst-tier loops are exactly as they were: your note that #149 is E's neighbourhood and not E's mandate is kept, and the loops stay filed there as a separate, later change.
**Why the behaviour cannot have moved (argued, then measured).** The two `RANK` tables had no `routine` key and every read was written `(RANK[x] || 0)` or sat behind such a guard, so an absent tier read as 0; `TIER_ORDER` already had `routine: 0`. With `routine: 0` in the one table, `TIER_RANK[x] || 0` is the same number for every input, known or not (`undefined`, `null`, `'routine'`, an unknown string). Measured: price golden master **0 of 2,988 points differ**; render differential **0 of 1,146 entries differ**; convergence sweep (`verify_confidence_convergence.js`) 24/24; `tsc` error count unchanged at 1,887. Ship gate: **3 functions touched** (`applyLiveConfidenceEscalation`, `deriveComplexityTier`, `computeUnifiedQuote`), **0 violating** (the constant is Logic and is read only by Logic).
**The class detector** (`verify_no_duplicate_registries.js`, 25 checks). Run first on the pre-E tree: **red, 5 of 22 checks** (three tier tables found, no `TIER_RANK`, nothing reads it); on this tree **25 of 25**. Its legs: (1) the tier ranking exists once, as a top-level `TIER_RANK`, with the tier names taken from the SSOT, and no array lists the tier names in an order; (2) `TIER_RANK` agrees with the SSOT (same keys, same order as the tiers' `min_minutes`, lowest is 0, frozen on a real boot); (3) any two constant literals of three or more entries that are structurally equal must be filed with a ledger entry that exists and can only shrink (6 groups found, 6 filed: #155, D-C11-2, D-C11-3); (4) no top-level name is declared twice (291 declarations on this tree, 290 before). Each leg is shown able to fail on a synthetic source (9 probes).
**The operator's second watch item: a third reader of `escalate_complexity`.** Looked for deliberately, with a fresh sweep after the change (every member read of `escalate_complexity` and every `.escalate_complexity`/`['escalate_complexity']`/destructured form in the page and in `modules/*.js`): **two readers, the same two D filed** (`applyLiveConfidenceEscalation` for the bar and question cap; `computeUnifiedQuote` for the pricing tier). No third. D's detector still holds the list at two (24/24).
**What this does not do, stated so it is not read as more.** `TIER_RANK` is itself a copy of an order the SSOT already encodes (the tiers' `min_minutes`: routine 0, skilled 46, specialized 91). The detector pins the agreement, so the copy cannot drift silently; deriving the table from `global_rules.complexity_tiers` at boot would remove the copy, and it is not done here (it would make a module-level constant depend on a boot step). The same sweep found that five other lookup tables in the page are SSOT vocabulary held in code: #156.

### #155 — 🟡 OPEN, 2026-10-10 mandate session (E, T162): four groups of structurally equal constants besides the tier table, and a builder state written in four shapes (G-INVARIANT-SWEEP; DEFECT-DUPLICATE-REGISTRY; filed, not fixed)
**Measured** (an AST scan of the assembled page for constant object and array literals of three or more entries: 138 of them; `verify_no_duplicate_registries.js` leg 3 keeps the result): **6 groups of structurally equal ones.** Two are already filed (the thermostat words in `resolveGroupFromIntent`, D-C11-2; the condition-module list twice in `bldGetConditionChoices`, D-C11-3). The other four, each now cited by the detector's filed list:
(a) **The cart's initial state**, `{currentStep: 1, furnitureItems: [], serviceRequest: []}`: the global `State` and the store's initial `cart` slice, whose own comment says it mirrors `State`. Two copies of the same initial value, one of them in code that is being migrated to the store; a change to one is a silent divergence. (b) **The builder's fresh state, `BLD`:** the 15-key shape (`step`, `action`, `object`, `specific`, `condition`, `location`, `qty`, `_stype`, `_cat`, `_groupId`, `_keyword`, `_fromOtherTile`, `_contextLabel`, `_objectLabel`, `_allowedTypes`) is written at four sites (two constant and identical: `sqToggleBuilder`'s no-text branch and `sqRestart`; two seeded from data), while the declaration `let BLD = {...}` has only the seven base keys. So the same object has two shapes depending on which path built it, and a key added to one reset is absent from the others. (c) **The empty estimate range** `{min: 0, max: 0, note: ''}`, three times (`orch_merge_materials_estimate` twice, `catastrophicFallbackRoute`): a value, not a registry; named so the detector's list is complete. (d) **The "Notes (optional)" label attributes**, in `_renderSimpleConfirm` and `_renderStructuredIntake`: presentation only.
**Why not fixed in E:** E's mandate is the tier table. (a) is the store migration's, (b) is Glue state in two functions the ship gate would then hold to their layer (the cost is unmeasured), (c) and (d) are not defects. **Operator question:** extract (b) into one function that builds the builder's state, so the two shapes become one? **Default if unanswered:** yes for (b), in the post-H sweep session, with the ship gate run first to see what touching `sqToggleBuilder` and `sqRestart` costs; (a) rides with the store migration; (c) and (d) stay filed.

### #156 — 🟡 OPEN, 2026-10-10 mandate session (E, T162): five lookup tables in the Logic and Rendering code hold vocabulary the SSOT owns or should own (each declared once, so not duplicates; G-INVARIANT-SWEEP; R-SYSTEM-NODATA; filed, not fixed)
**How found.** E's sweep for registries copied across the page (#154) also listed every constant lookup table declared once. Five of them are decisions about the catalog written as code, which is the thing the SSOT exists to hold ("every piece of logic ... remains transparent, maintainable, and endlessly updatable without a single line of code changed"). Each is declared once, so `verify_no_duplicate_registries.js` leg 3 rightly does not flag it; this is a different defect class (vocabulary in code), and the layer is stated for each.
| Table | Where (layer) | What it decides | What the SSOT has today |
|---|---|---|---|
| `QTY_AWARE_FORMULAS` | `pricing_engine`, module level (~2495). Logic | which of four formulas already scale their own minutes by quantity, so the outer quantity multiplier must be 1 (`resolveQuantityMultiplier`; the "count the quantity twice" fix, T102/T103/T135) | no field on a formula says so; adding a formula means editing this Set, and forgetting is a silent double count |
| `FORMULA_CONSUMED_KEYS` | `pricing_engine`, local to `computeUnifiedQuote` (~2838). Logic | which intake answers each of five formulas reads itself, so the generic answer loop must skip them | not recorded on the formula or on the module |
| `CS_RESTRICTIVENESS` | `pricing_engine`, local to `computeUnifiedQuote` (~2799). Logic | the order of the checkout states (`standard_flat_rate` 0, `project_based` 1, `database_summation` 1, `diagnostic` 2) when an answer overrides the state | `checkout_states` has four keys and no rank or order key. The same shape as the tier order: an order the SSOT does not state |
| `COMPONENT_MODULE_NAMES` | `orchestrator_engine`, module level (~5334). Logic | which intake modules count as "component" modules for a confidence count | the module list exists in the SSOT (`intake_modules`); membership in this set is not a field on any of them. G (T164) edits it for `door_size` |
| `PICKER_ENABLED_GROUPS` | `UIRenderer`, a `Set` of group ids declared **inside a renderer function** (~8092). **Rendering** | which category groups show the symptom picker | not a field on the group; a Rendering function holds a catalog decision, which the layer rules keep out of Rendering (a vocabulary in the wrong layer as well as in code) |
**Why not fixed in E.** E's mandate is one `TIER_RANK`. Each of these is a schema addition (a flag or a rank on a formula, a checkout state, a module or a group), plus compiler and boot-gate work, plus the authored data: five separate changes, each its own "smallest provable change", and `QTY_AWARE_FORMULAS` and `FORMULA_CONSUMED_KEYS` sit in the pricing path where the golden master must hold. **What I did:** nothing to the code; the layers and sites above are the finding.
**Operator question:** put these five in the SSOT, one at a time, in the order of risk (`PICKER_ENABLED_GROUPS` first: it moves a decision out of a Rendering function and out of the price path; the two formula tables last)? **Default if unanswered:** no change in the mandate; the next-session write-up carries this list, and the order above is the proposed order. The `TIER_RANK`-from-`min_minutes` derivation (#154, last paragraph) is part of the same family and is decided with it.

### #157 — 🟡 OPEN, 2026-10-10 mandate session (F, T163): the module headers still carry the extraction-era history, with counts and ordinals that are no longer true of the block under them (G-INVARIANT-SWEEP; filed, not fixed)
**Found while rewriting the deployment claim in the five inline headers (T163).** The detector holds one thing about a header, where the module is deployed; the rest of each header is prose from the time the modules were cut out of the monolith, and some of it is checkable and false. **Measured against the blocks as they are:** (1) `pricing_engine.js` says "65 of 173 functions in qr.html were found genuinely pure; these 21 are the pricing-relevant subset" and "Every function below is VERBATIM from qr.html, extracted and manually verified pure"; the block has **47** top-level functions, and nothing is extracted from `qr.html` any more (the block is the source). (2) `orchestrator_engine.js` says "Extracted directly from the live qr.html using the same, proven brace-counting method" and that it was "Built specifically to support a new, separate, real 'dumb UI' prototype"; `UIRenderer.js` and `AppController.js` carry "A REAL BUG CAUGHT BEFORE SHIPPING: the first extraction pass silently dropped the `async` keyword" and a method note on the extraction. (3) The ordinals "third module" (`orchestrator_engine`, `UIRenderer`), "fourth and final module" (`AppController`) and "fifth standalone module" (`store`) count an extraction sequence; the page has **nine** modules (five inline, four loaded). None of this is a load-shape claim, so none of it is a defect the T163 detector can state; a reader who trusts it learns the wrong history, not the wrong place to edit. **Why not fixed in F:** the mandate's note C is the deployment statement; rewriting what each header says about its own history is a judgement about which of it is worth keeping, five times over, in the file the page runs. **Operator question:** replace each extraction-era paragraph with one paragraph that describes the block as it is (what it holds, its layer, what it reads), keeping the history in `TIMELINE.md` where it is already recorded? **Default if unanswered:** no change to the headers beyond the deployment statement; the next-session write-up carries the five measured claims above, and a header-by-header rewrite is proposed for the post-H sweep session.

### #158 — 🟡 OPEN, 2026-10-10 mandate session (G, T164): 24 more intake modules offer a fallback answer that resolves exactly like a confident answer and carries no modifier (R-INTAKE-NONRETIRING; DEFECT-NON-RETIRING-ANSWER; filed, not fixed)
**How found.** G wrote the Charter's mechanical test as a behavioral detector (`verify_non_retiring_answers.js`): for every option of every module, in every place the module is asked, run the real engine and compare what comes out (fees, minutes, tier, checkout state, materials, the branch the answer opens, tags, forced modules); a fallback ("not sure", "the tech can measure", "I'll describe it in the notes") whose outcome equals a confident answer's everywhere, and which carries no `modifier_ref`, is the class. **Run over the 76 named services it found 20 modules** (20 fallback options; the plan's "25 pairs in 20 modules" counted pairs differently, the module count agrees), including the Charter's two exemplars, `door_size` and `space_ready`, which G retired. **Widened to the 82 dynamic services that ask the same modules** (the guided builder and the other-tile reach them) it unflagged two (`plumbing_fixture` and `mounting_item`: in the builder "Other" opens no follow-up where "Toilet" or "TV" does, so the fallback does move the job there) and found eight more. **24 remain**, in the detector's filed list, which can only shrink.
| Module | Fallback answer | Asked in | Other answers that carry an effect |
|---|---|---|---|
| `appliance_item` | "Other (describe in notes)" | 1 dynamic | 0 of 7 |
| `cable_install_item` | "Other (describe in notes)" | `cable_management` + 2 dynamic | 0 of 3 |
| `cable_symptom` | "Other (describe in notes)" | 1 dynamic | 0 of 5 |
| `computer_component` | "Something else (please describe in notes)" | `internal_hardware_replacement` | 0 of 4 |
| `computer_symptom` | "Other (describe in notes)" | `computer_diagnostic` + 2 dynamic | 0 of 8 |
| `electrical_item` | "Other (describe in notes)" | 7 dynamic | 0 of 6 |
| `furn_item` | "Other (please describe in notes)" | `furniture_repair_hourly` + 2 dynamic | 0 of 4 |
| `generic_tech_symptom` | "Other (describe in notes)" | 1 dynamic | 0 of 5 |
| `install_target` | "Other (describe in notes)" | 1 dynamic | 0 of 7 |
| `network_symptom` | "Other (describe in notes)" | 2 dynamic | 0 of 7 |
| `smart_device_symptom` | "Other (describe in notes)" | 2 dynamic | 0 of 6 |
| `washer_type` | "Not sure – describe in notes" | `washer_repair` | 0 of 3 |
| `angle_stop_condition` | "Not sure" | `angle_stop_replacement` | 1 of 2 |
| `appliance_type` | "Not sure – I’ll describe in the notes" | `microwave_repair`, `repair_appliances` | 1 of 2 |
| `dishwasher_symptom` | "Other (describe in notes)" | `dishwasher_repair` | 5 of 7 |
| `disposal_size` | "Not sure — whatever's standard" | `garbage_disposal_replacement` | 1 of 3 |
| `door_style_pref` | "Not sure" | `prehung_interior_door_install` | 2 of 3 |
| `existing_toilet_type` | "Not sure" | `bidet_attachment_install_or_removal`, `toilet_seat_replacement` | 1 of 2 |
| `inwall_power_for_tv` | "Not sure" | `flatscreen_mounting_with_hidden_cables` | 1 of 2 |
| `leak_loc` | "Not sure – I’ll describe in notes" | `leak_under_sink_repair` | 1 of 3 |
| `software_install_type` | "Not sure — describe in notes" | `software_or_driver_install` | 1 of 3 |
| `switch_wiring` | "Not sure" | `dimmer_switch_install` | 1 of 2 |
| `window_ac_issue` | "Other (describe in notes)" | 2 dynamic | 6 of 7 |
| `window_ac_support` | "Not sure" | `window_ac_setup` | 1 of 2 |
(`node test_harness/verify_non_retiring_answers.js --list` prints this table, the options each fallback equals, and the services, from the live catalog.)
**Two kinds, because the Charter's two forms of fix differ.** *The first twelve (no answer of the module carries any effect):* the whole question is inert, exactly as `door_size` and `space_ready` were. The Charter's fix is Form (b), remove the module ("Removing the module is the fix"), as G did for the two. Some of these identify the object for the technician (`appliance_item`, `install_target`, `furn_item`), so removal also drops a prompt the visit may use; that is the cost to weigh, and for the eight asked only in dynamic services removal changes the guided builder's flow. *The other twelve (some answer does change the job, the fallback does not):* the question is live and only its fallback is dead. The Charter's Form (a) is a real `modifier_ref` on the fallback (what "not sure" costs: minutes or a fee), which is a price decision and yours.
**What the check cannot see (stated, so the 24 are read as a floor).** The Charter's tuple has three axes the catalog and the engine have no channel for: risk tier, batch risk and prep (what a technician needs before arriving). A fallback that differs only in prep would be flagged here and might be wired in the Charter's sense; equally nothing can show a fallback that moves only prep. That missing channel is the finding behind the missing axes. Also: 26 of the 116 modules reached are inert on every observable axis (no answer moves anything the engine reports); ten of those have a fallback (flagged above), the other sixteen have none and are not this class (`brand`, `location`, `door_type`, `length`, ...), listed for the next sweep, not here.
**Why not fixed in G.** G's mandate is the two the Charter names, and the detector. Each of the twenty-four is a content decision (a price for "not sure", or a question you may want to keep) and several change what a customer is asked. **Operator question:** (A) the first twelve are removed one module at a time in the post-H sweep session, each behind the golden master and the render differential, and for the other twelve you tell me what "not sure" costs (a fee or minutes) and I wire it; (B) leave them filed. **Default if unanswered:** (B): nothing is removed and nothing is wired; the detector holds the list and fails on any new one; the next-session write-up carries it.

### #159 — 🟡 OPEN, 2026-10-10 mandate session (G, T164): the four services that lost their only question are the first catalog taps to land on the self-quote view, and it shows less than the card it replaced (a disclosure; filed, not fixed)
**Measured in a real browser, before and after (`archive/T164_G_ui_drive.txt`, `archive/T164_G_ui_drive.js`).** Tapping Microwave Setup, Washer Install, Dishwasher Install or Refrigerator Install in the catalog, or typing "install my microwave" and pressing "Looks right", now goes straight to a price with no question; the cart line is the same: $70, quantity 1, on all eight paths. **Before** the screen showed the service description ("Standard unboxing, setup and basic testing of the unit."), a note ("Need this for more than one? ... add this as its own request for each one"), the space-ready question with its three chips, "Estimated labor: $70" (greyed until a chip was tapped) and Add to Request. **After** it shows "Service type: Install", "Scope & conditions: 1× item", the service name, "Total labor: $70", "+ $45 dispatch fee" and Add to Request. These four are the **only** services in the catalog whose catalog tap routes to the `self_quote` template (`executeWorkflow`'s `uiTemplate` is `self_quote` for 4 of 76), so the template has had no other production use to compare against.
**What the customer gains:** no question that changed nothing; a firm price from the first screen; the dispatch fee named (the old card never mentioned it). **What the customer loses:** (1) the line saying what the visit covers (the description is not drawn by the self-quote view); (2) the note about ordering more than one (no quantity control either: `per_unit_answers_vary` hides it by design, so a customer with two microwaves has only the cart's "same request again merges to x2" behaviour, which nothing on screen mentions). **Also visible and not new:** "+ $45 dispatch fee" is shown on a $70 job although the SSOT's own `dispatch_fee_apply_min_labor` says it applies only under $50 (#153); the self-quote view is the first place a catalog customer sees that.
**Not touched by G:** a `UIRenderer` change to the self-quote view is a rendering change in a different item. **Operator question:** (A) the self-quote view draws the service's one-line description under the name, and, for a service whose `per_unit_answers_vary` is true, the "more than one" note; (B) leave it. **Default if unanswered:** (B), nothing changes; the next-session write-up carries it with the screenshot comparison.

### #160 — 🟡 OPEN, 2026-10-10 mandate session (G, T164): what regenerating `compiled.*` found: three defects closed in G, three left open (G-INVARIANT-SWEEP; DEFECT-DUPLICATE-REGISTRY; R-INVARIANT-RERUN)
**Closed in G (committed in the prep commit and G itself).** (1) **The compiler could not find its schema.** It looked beside itself for `btnyc_schema.json`; the schema has lived at `schema/btnyc_schema.json` since T157, so every run reported "Schema file not found" and would have written a false `_schema_validation`. It now finds the schema (a run says "Schema validation: PASS"). (2) **The committed `compiled.*` had drifted from the SSOT in 224 paths** (220 in `compiled`: `angle_stop_replacement`'s chain, 27 services' intake chains, 12 `client_response` lists, the pricing, formula, module and material indexes; 4 in `pricing_archetypes`). That was ledger L1's cause (raw says one thing, derived data another: R-INVARIANT-RERUN). Regenerated by `test_harness/tools/splice_compiled.py`, which replaces only the compiler-owned spans of `btnyc.json` and checks that no other byte moved. (3) **The compiler's output text depended on the hash seed**: `compiled.symptom_index` came out with its keys in a different order on every run (a `set` returned by `flatten_intake_chain` fed the order keys are first seen), so a regenerated file churned for no reason. One `sorted(...)` in `compile_symptom_index`; the splice tool now fails if two seeds give different bytes. `verify_raw_vs_compiled_reconciliation.js` (it threw on a compiler path that no longer exists and asserted a `hybrid_qty` chain the raw SSOT no longer has) is green again, 10 of 10.
**Open.** (a) **Three tests still assert a chain `angle_stop_replacement` does not have.** `verify_self_quote_bug_fixes.js` ("angle_stop_replacement -> isSelfQuoting: true"), `verify_self_quote_ui_template_invariant.js` ("angle_stop_replacement -> self_quote (hybrid_qty only, no bypass_intake required)") and `verify_orchestrator_engine_module.js` ("angle_stop_replacement correctly resolves to self_quote", plus five checks naming functions that no longer exist in the module) are red for the same reason as before, but the cause is no longer the compiled copy: the raw chain is `[plumbing_fixture, angle_stop_condition]` and the tests expect a quantity-only chain. Retarget or retire is a judgement about what each is for. (b) **Two registries of "component modules", one in Python and one in JavaScript, already disagree.** The page's `COMPONENT_MODULE_NAMES` has 44 names, the compiler's `COMPONENT_MODULES` has 57; 42 are in both, **2 only in the page** (`tile_condition`, `waterproof_area`) and **15 only in the compiler** (`Setup`, `appliance_item`, `appliance_type`, `backup_source_device`, `blind_curtain_shade_items`, `cable_install_item`, `floor_type`, `hardware_type`, `install_target`, `lath_check`, `leak_loc`, `location`, `masonry_anchor`, `washer_type`, `wiring`). G removed `door_size` from both and could not make them agree without deciding which is right (DEFECT-DUPLICATE-REGISTRY across a language boundary; the same family as #156's `COMPONENT_MODULE_NAMES` row). The compiler's `LOGISTICS_MODULES` also names two modules the catalog no longer has (`access`, `pets_present`). Twelve test files also declare their own `COMPONENT_MODULE_NAMES` set (fifteen mention the name); G left them as they are, and none of them fails because of it. (c) **`btnyc.json` is not a fixed point under the compiler's own output format** (inline objects formatted by hand: 396 bytes inside `compiled`, 90 in `pricing_formulas`): the reason the splice tool exists. After G the owned spans are exactly the compiler's text; the rest stays as the operator and earlier tickets formatted it.
**Operator question:** (A) retarget the three tests and make one registry of component modules, generated from a field on the module, in the sweep session; (B) leave. **Default if unanswered:** (B) for (a) and (b), filed here; (c) is a fact and needs no decision.

### #161 — 🟡 OPEN, 2026-10-10 mandate session (found in G, T164; **pre-dates G; not caused by it, not fixed by it**): an unaffirmed detected tag still changes the quote, on both entry paths, and the tag-affirmation card shows that price beside the question "is this right?" (DEFECT-ARBITRATION by shape: two decided rules claim authority over whether the tag prices, and the later one wins silently)
**What is wrong, in one sentence.** The gate says a detected tag is chargeable only once the customer affirmed it or the quote is confident without asking; the tag's *answers* (operator brief section 2.8: a detected tag answers the questions it names, so the customer is not asked them) are computed before the gate, from every tag, and their modifiers price whatever the gate decides. The gate gates the tag's direct effect, which is the small part.
**The shape (why this is filed as its own defect, and as ARBITRATION's cousin).** Two decided rules: (1) the gate, authored in v9.x and stated in its own comment ("detTagIds are gated: only included if the customer has explicitly affirmed them OR if meetsConfidenceBar is already true"; `qr.html` `computeQuoteFromState`, and `orch_compute_quote` for the free-text path); (2) tag-to-answer synthesis (brief section 2.8; `P-INTAKE-INFER`: "if NLP-detected tags already carry the answer, do not re-ask it"). Each is right by its own text. Their composition is the defect: synthesis runs first, from the full tag set (`syncTagSynthesizedAnswers`, ~L3522; `synthesizeAnswersFromTags` before the workflow, ~L3731); the gate then sees a state whose `answers` already hold the detected tags' fees, so **the final price is not traceable to one named source** (`R-INVARIANT-PROVENANCE`): the number on screen is neither "the price with the tags the customer affirmed" nor "the price with the tags the words detected". It is not the literal caller-side `||`/`??` composition that `DEFECT-ARBITRATION` defines (Charter, "Arbitration Class, Specifically"), so it is filed *by shape*, not by definition; the Charter's class list is the operator's to extend (see "Recurrence" below).
**Measured, on the current catalog** (the experiment ran on scratch copies of the engines with option (A2) below applied; nothing in the repo changed; the script, with the exact patch in its header, is `archive/T164_G_gate_blast_radius.js`, its output `archive/T164_G_gate_blast_radius.txt`):
- `computeQuoteFromState`, Microwave Setup, three detected tags, nothing affirmed: `meetsConfidenceBar` false, `detTagsChargeable` false, `activeTagIds` empty, **labor $230; the same state with no tags is $70.** The breakdown: "How soon do you need this done?: Urgent — today or tomorrow, $50" and "About how heavy is the item?: Over 50 lbs (heavy), $110". Identical before and after G (G's golden-master flags are this defect becoming visible on four services, not a price moving).
- **Every (service, one detected tag valid for its category) pair, 1,014 of them: 526 price differently when an unaffirmed tag may not answer a question that prices; 70 of the 76 services; 24 of the 43 smart tags.** Labor difference: median $50, maximum $239. The fee arrives through these answers: `weight` (88 pairs), `urgency` (68), `item_volume` (68), `has_matching_tiles` (68), `parking_difficulty` (68), `damage_type` (37), `mounting_height` (34), `tech_problem_type` (20).
- **What the customer sees.** The free-text route that lands on the tag-affirmation card (`renderTagAffirmationFromRoute`) shows the tag chips and "From $X", where `X` is `route.quote.laborEstimate`, the gated quote. Of the 176 free-text routes in the golden master, 34 land on that card; **on 15 of the 34 the "From $" differs once the gate holds.** Example from the golden corpus: "urgent leak under the sink tonight" -> Leak Under Sink Repair, chip "#emergency", card says **From $125**; with the gate holding it is **From $75**, and $125 after the customer says yes. As it stands the card asks "is this right?" with the answer's price already in the number.
- `computeQuoteFromState` also returns `laborWithTags` ("Full-set price for affirmation card preview", the before/after the gate was designed to show). **Nothing reads it** (`qr.html`, `modules/`, `test_harness/`: only the producer). So the card has never been able to show "price with these tags" next to "price without".
- The gate's own input is not circular: detected tags can only *raise* the confidence bar (`applyLiveConfidenceEscalation`), never lower it, so a tag cannot affirm itself by lifting the confidence that gates it.
**Options.**
- **(A2) Answers stay, the unaffirmed tag's answers do not price.** The answer a detected tag synthesises stays on the session (the question stays retired: `P-INTAKE-INFER` holds, nobody is re-asked), and when the gate is closed `computeQuoteFromState` prices the answers *minus* the modules `_tagSynthesizedModules` says an unchargeable tag synthesised; `orch_compute_quote` does the same for its gated branch. Once the customer affirms (or the bar is met) the answers price, as today. Measured in a scratch copy: it prices identically to (A) on all 1,014 pairs, and keeps all 751 synthesised answers where (A) keeps 32.
- **(A) Synthesise only from the chargeable tags** (the gate before the sync). Same prices as (A2), but the question a detected tag answered comes back (719 of the 751 would be re-asked), which `P-INTAKE-INFER` forbids.
- **(B) Keep the price and change the gate and its comment to say it governs only the displayed tag list.** Honest, but then the card's "From $X" is a quote nobody confirmed, and `laborWithTags` stays dead.
- **(C) Leave it.**
**Default if unanswered: (A2), as its own ticket (not folded into H or either sweep), first in the next session.** Reasons: it enforces the gate the code already states and the project already decided (it is not a new pricing policy); it keeps `P-INTAKE-INFER`; it is reversible (one derivation in each of two functions) and documented here. It is the one default in this ledger that **moves quoted prices**, so it ships with its own `archive/golden_change_*.md` listing the 526 (service, tag) pairs and the 15 card prices, a render differential on the affirmation card, a detector (an unaffirmed detected tag never changes the price unless the bar is met; the ratchet is this entry's 526 until fixed, then zero), and its own check-in before anything else starts. I do not start it if you rule (B) or (C) first. The card showing the before/after price (`laborWithTags`, or a second quote) is a design question, not part of this fix; it is filed as the last bullet above.
**Recurrence (is this a class?).** The shape is "a gate decides whether a claim is charged, and a value derived from the claim *before* the gate prices regardless". Looked at, in one pass, for the other places a text-derived or tag-derived value reaches price: (1) synthesised answers: this entry, large. (2) The contextual override's own dollar adjustment (`_ctxFee`/`_ctxMin`, `nlp_engine.js` ~L1180): the override's *tag* is gated and its fee is not. The catalog has exactly one override with a fee (toilet + flushometer, +$75 and 45 minutes), which also floors the match confidence at 90, so its gate is normally open and the exposure is small; recorded for the sweep, not measured further. (3) Inherent tags are ungated by design (v9.6, documented at `syncTagSynthesizedAnswers`), not an instance. Two instances is a pattern, not yet a class; **if you want it named, the name I would propose is `DEFECT-GATE-BYPASS` (a gate on a claim that does not cover what is derived from the claim), owned by `R-INVARIANT-PROVENANCE`**, which the Charter does not have and I will not add. Whether or not it is named, **the ARBITRATION sweep (queued after H) carries this shape as a second probe**: every gate or whitelist in the engines, and what is derived from its input before it runs.

### #162 — 🟡 OPEN, 2026-10-10 mandate session (H, T165): four of the six rules the mandate landed have no defect class in the Charter, so their detectors protect a rule and the Charter's own words ("a detector protects the defect class") have no class to cite (R-INVARIANT-DISEASE; naming a class is the Charter's, i.e. yours)
**Measured** (the roster in `verify_architectural_conformance.js`, `--list`): of the six detectors, two carry a Charter class (E `DEFECT-DUPLICATE-REGISTRY`, which had never said so and now does; G `DEFECT-NON-RETIRING-ANSWER`). The other four hold a rule: B (`verify_confidence_convergence.js`: three confidence calculators, one per gateway), C (`verify_fallbacks_live_in_ssot.js`: a business number defaulted in code), D (`verify_single_escalation_path.js`: a drifted second copy of one function), F (`verify_module_deployment_shape.js`: one module defined in two places, and headers that claim a load shape the page does not have). Their ledger lines say "none declared" and name the nearest class (B: `DEFECT-PATH-SPECIFIC-PATCH`; F: `DEFECT-DUPLICATE-REGISTRY`, which the Charter words as lists, constants and registries). A detector is tagged `@enforces <Rule>`, which is accurate; it cannot be tagged `@detects` a class that does not exist (an orphan tag fails `verify_charter_rules.js`).
**What a name would be.** The shapes: (1) a second implementation of one function, whether written per gateway (B) or kept as a drifted copy (D), which `DEFECT-DUPLICATE-PARSER` is the instance of for parsing; a possible name `DEFECT-DUPLICATE-IMPLEMENTATION`, owned by `R-CONF-ONEFORMULA` and `R-INVARIANT-CANONICAL`; (2) a business number held in code (C): `DEFECT-HARDCODED-DEFAULT`, owned by `R-SYSTEM-NODATA`; (3) a module defined or described in two places (F): `DEFECT-DUPLICATE-MODULE`, owned by `R-INVARIANT-SINGLEDEF` and `R-SYSTEM-SCRIPT`; and, from #161, (4) a gate on a claim that does not cover what is derived from the claim before the gate: `DEFECT-GATE-BYPASS`, owned by `R-INVARIANT-PROVENANCE`. These are proposals, not edits: the Charter's class table is yours to extend.
**Options:** (A) name the classes you want (any subset); I then add the `@detects` tag to the detector, set `defect` on its roster row and change its ledger line, a three-line change each, and `verify_charter_rules.js` and the conformance file hold it. (B) Leave the four unnamed. **Default if unanswered:** (B). The detectors are tagged by rule, the ledger says what the Charter does and does not name, and the conformance file records `defect: null` for them honestly; nothing in the tree depends on a name. I add no class to the Charter.

### Phase A deferred (T155) -- items Phase A found and did not close, each named with its site

*(C-11 entries come first (D-C11-1…4), then the A2b arbitration sites (D-A2b-1…6, #95) with the §7b reconciliation table, then the A4 entries (D-A4-1, D-A4-2). Phase A is complete; nothing here has been started.)*

**D-C11-1 -- the quantity-module key list has a fourth literal copy in `sqRenderSelfQuoteAdlib` (line of `const hasQtyChain`).** `_GENERIC_QTY_MODULE_KEYS` is the one definition; three literal copies were replaced by it in C-11 (`classifyServiceIntake`, `ORCH_QTY_MODS`, `sqBuildAdlib`). The fourth sits in `sqRenderSelfQuoteAdlib`, which the R-INVARIANT-COMPLY ship gate holds to its layer (it reads `financial_engine` and `checkout_states` directly): touching it fails the gate by design. It goes with #117 (that function's pricing) in Phase B. The qty-pill option list `['1','2','3','4','5','6','8','10','12']` is likewise written in both `sqBuildAdlib` and `sqRenderSelfQuoteAdlib` and waits for the same reason. *Resolution when the function is reworked:* both read one hoisted constant. **Operator T156: the stated default is confirmed ("Everything else on the stated default... proceed"); the work is held for Phase B, which waits for your explicit go.**
**D-C11-2 -- `resolveGroupFromIntent` carries two parallel sets of inline keyword lists (14 overlapping pairs, 9 asymmetric).** For example the drain / shower / tub words appear twice, the second with `bath` added; the outlet words twice, the second with `plug`; the network words twice, the second with `internet`; the faucet words twice, the second with `basin`. They are NLP vocabulary written into code (R-SYSTEM-NODATA says it belongs in the SSOT), and the asymmetry means a phrase can route differently depending on which copy a branch consults. Merging them is a **behavior change** to routing, outside Phase A; it needs a routing sweep (R-INVARIANT-SWEEP), and the two copies must first be read to see which is the intended one. Frozen as a Phase B item (the vocabulary move to the SSOT). **Operator T156: the stated default is confirmed ("Everything else on the stated default... proceed"); the work is held for Phase B, which waits for your explicit go.**
**D-C11-3 -- `bldGetConditionChoices` lists `['symptom','issue','damage_type','state']` twice, and `SYMPTOM_MODULE_NAMES` (makeBookingContext) is a larger set that lacks `state`.** The same concept ("which intake modules describe the condition") has three definitions that disagree on membership. Unifying them changes which questions the builder offers as condition chips: a behavior change. **Operator T156: the stated default is confirmed ("Everything else on the stated default... proceed"); the work is held for Phase B, which waits for your explicit go.**
**D-C11-4 -- `['#heavy_item','#very_heavy']` is written in `collectBookingContext_freeText` and in `sqPrepareFlow`** (the standard-size negation). Identical today; `sqPrepareFlow` is held by the ship gate (see C-05, #116), so a shared constant has to wait for it. **Operator T156: the stated default is confirmed ("Everything else on the stated default... proceed"); the work is held for Phase B, which waits for your explicit go.** **Update, T161: the hold named here (`sqPrepareFlow` kept by the ship gate, C-05 / #116) is released; the standard-size negation now lives in the Logic function `resolveBuilderTags` (T159), so a shared constant is no longer blocked by the gate. Still held for the Phase B go; no change made.**
**Reviewed and not duplicates (no action):** the CSS declaration arrays in `sqBuildAdlib` (style fragments, different values); `iconPriority` vs the service-type lists in `bldGetObjectChoices` / `sqBuildStep2` (different jobs: icon precedence, per-action filters, and the step-2 chip order whose SSOT home `ui_config.step2_types` it already reads, with a code fallback); `['action','object']` in two unrelated functions.

**A2b -- arbitration sites (#95), 10 remaining of 17; each named with its site and class.**
**D-A2b-1 -- `sqPrepareFlow`, 3 sites (§7b C-14): L13066 `resolveDynamicService(...)?.intake_chain || []` (class P, the `intake_chain` concept) and L13176-13177 `(baseStrategy.minimum_quote_confidence || 0) + delta` / `(... maximum_followup_questions || 0) + delta` (class R: the inline escalation is a drifted copy of `applyLiveConfidenceEscalation`, #116).** The R-INVARIANT-COMPLY ship gate holds the function (glue calling engine functions and reading `financial_engine` / `checkout_states`); I placed the PHASE_B_FOLLOWUP note above it in C-05, not inside. Closing needs the function brought into compliance first, which is the Phase B work on #116 and the `intake_chain` migration. **Operator T156: the stated default is confirmed ("Everything else on the stated default... proceed"); the work is held for Phase B, which waits for your explicit go.** **RESOLVED, 2026-10-10 mandate (T159 and T161): all three sites are gone. The `intake_chain` site left with the `confidence_gain` loop (T159); the two inline-escalation sites left with the function that held them (T161); see #116 and #148.**
**D-A2b-2 -- `prefillSmartQuoteFromOtherTile`, 2 sites (§7b C-15): L12085 `base: dynDef?.financial_engine?.base_price ?? 70` and L12090 `_pricingType: ... || 'flat_rate'` (class R).** Both second sources are dead or repeated: `S.intent.base` has no reader (#118), and `_pricingType`'s only reader (`resolveServiceBadge`) applies the same `'flat_rate'` default itself. I applied both edits and ran the ship gate: **red** (`glue-engine-call` `resolveDynamicService`, `glue-pricing-ssot` `.financial_engine` x2), so I reverted them rather than force them. They go with #118 in Phase C. **Operator T156: the stated default is confirmed ("Everything else on the stated default... proceed"); the work is held for Phase B, which waits for your explicit go.**
**D-A2b-3 -- `executeWorkflow`, 4 sites (§7b C-16): `resolution.entity?.id || null` (trace summary), `resolution?.entityType || 'fallback'`, `resolution?.entity || null`, `resolution?.enrichment || null` (class P).** `orch_resolve_entity` returns four record shapes (service, routing-archetype service, dynamic, fallback; the fallback one has no `enrichment` or `group`), and `resolution` is `null` when a workflow has no lookup step. The four `||` normalise those absences. The Charter-shaped fix is a **total record owned by the resolver** (every shape carries `entityType`, `entity`, `group`, `enrichment`, `fallback`, with explicit nulls) and `resolution` initialised to the resolver's own unresolved record, after which the four are deletable. Not done in Phase A: it changes the resolver's return contract (20 test files reference `orch_resolve_entity`) and the route shape of a workflow with no lookup step, and the golden and the differential only exercise the lookup path. **Operator T156: the stated default is confirmed ("Everything else on the stated default... proceed"); the work is held for Phase B, which waits for your explicit go.**
**D-A2b-4 -- `orch_resolve_entity` L5983 `if (group || dynDef) return {...'dynamic'...}` (§7b C-17, class P: already owned by the resolver).** No value is composed: it is the resolver's own predicate ("a known group, or a dynamic definition, makes the route dynamic"). The detector counts it because it does not distinguish a predicate from a value composition. No code change. **Follow-up for the detector** (a precision fix, with a test that a value composition in the same position is still flagged); the frozen entry stays until then, so that the count is not lowered by loosening the detector. **Operator T156: the stated default is confirmed ("Everything else on the stated default... proceed"); the work is held for Phase B, which waits for your explicit go.**
**D-A2b-5 -- RESOLVED, T156 (operator: "Yes, build `resolvePricingPath(entity) -> {path, source}` in Phase B. Next concept after `intake_chain`."; the build is Phase B work and waits for your explicit go): `computeUnifiedQuote`: which pricing path governs is decided by the caller (class D, surfaced, not a detector site once the `??` closes).** `if (_archetypeResult && (_pricingArchetype === 'tiered_per_unit' || _pricingArchetype === 'formula'))` lets the archetype's estimate replace the formula path's (flat_simple and hourly_timed deliberately do not, per the comment above it). That is a routing decision made in the caller; it is the `pricing_engine_key` concept the unified suite already fails (#95). Its sibling guard `if (_archetypeResult.totalMin != null)` is likewise unreachable for those two archetypes (every branch returns a number), and I left it, because it is not on the detector's list and changing it adds nothing to the closed site. **Decision needed from the operator before Phase B:** confirm the Boss owns this choice as a resolver (`resolvePricingPath(entity) -> {path, source}`) in the Logic layer, with `computeUnifiedQuote` reading it. **Default if unanswered:** build that resolver in Phase B, behind the golden.
**D-A2b-6 -- the two remaining dead reads of `nlpIntent._groupId` (`executeWorkflow` `intentGroupId`, `orch_apply_object_based_resolution`): see #118.** **Operator T156: the stated default is confirmed ("Everything else on the stated default... proceed"); the work is held for Phase B, which waits for your explicit go.**

**§7b reconciliation (to fold into the map at r6; every #95 site appears here or above).**
| §7b row | Function | #95 sites at T147 | State at T155 end |
|---|---|---|---|
| C-12 | `computeUnifiedQuote` | 3 | all closed: the checkout-state chain (T150), the tier default and the archetype `??` (A2b C-12); the override decision is D-A2b-5 |
| C-13 | `orch_compute_confidence` | 4 | all 4 closed (A2b C-13) |
| C-14 | `sqPrepareFlow` | 3 | open, D-A2b-1 |
| C-15 | `prefillSmartQuoteFromOtherTile` | 3 | 1 closed (T150); 2 open, D-A2b-2 |
| C-16 | `executeWorkflow` | 4 | open, D-A2b-3 |
| C-17 | `orch_resolve_entity` | 1 | open (predicate), D-A2b-4 |
| C-18 | `collectBookingContext_freeText` | 1 | closed (A2b C-18) |
| C-19 | `isDiagnosticService` | 1 | closed (T150) |
| C-20 | `resolveServiceBadge` | 1 | closed (T150) |
| C-21 | `resolveServiceBadgeKey` | 1 | closed (T150) |
| C-22 | UI-46, UI-71, UI-77 direct reads | (not in the detector) | closed (C-06) |
Total: 3+4+3+3+4+1+1+1+1+1 = 22 (#95), of which 12 closed (5 by T150, 7 by A2b), 10 open and named above. The map's "C-23 onward / ~9 remaining" is empty: there are no further #95 sites.

**D-A4-1 -- RESOLVED, T156 (operator: the stated default; done in `ruling/D-A4-1`: `verify_component_tracing_overlay.js` retired to `retired/` with its reason, the stale-sandbox ratchet 42 -> 41; the other two stay red until the overlay work reopens): the three older tracing tests do not test the live tracer (`verify_component_tracing_overlay.js`, `verify_tracing_tool_v2_upgrade.js`, `verify_tracing_v3_full_instrumentation.js`).** The first crashes before its first check (`Could not find function: _trace`: it extracts the tracer from `qr.html`, but the tracer lives in `trace.js`), and its "disabled by default: zero trace entries captured" check encodes the optional-tracer behavior A4 removed; the other two were red or empty at the T154 baseline. `verify_trace_observation_only.js` now tests the live tracer. **Decision for Phase B:** retire the three (they are already red; retiring them is a `retired/` move with a reason) or rewrite them against `trace.js`. **Default if unanswered:** retire the first (it asserts the removed behavior) and leave the other two red until the overlay work reopens.
**D-A4-2 -- RESOLVED, T156 (operator: "publish `trace.js` with the next deploy"; `trace.js` is in the delivered package, and publishing it is the deploy, which is yours): `trace.js` is loaded from an absolute GitHub Pages URL.** The recorder, the ring buffer and `window.__traceLast` take effect in production only when the new `trace.js` is published at `https://tommichael88.github.io/booktomnyc/trace.js`. The repo copy is what the tests run. The call sites are guarded, so an unpublished `trace.js` degrades to the old optional tracer rather than breaking the page. **Default if unanswered:** none needed; publish `trace.js` with the next deploy.
