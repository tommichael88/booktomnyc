# T183 — Review of the amended Charter (the edition attached 2026-10-22 20:36 NY; see the "Update (T185)" and "Update (T188)" notes at the end for the re-amended editions)

**Edition reviewed:** `PROJECT_CHARTER.html`, 733,234 bytes, sha256 `a56379db3c7290ee…`; byte for byte the Project's copy (`PROJECT_CHARTER.html`, saved 2026-10-23 00:34 UTC) and now the repository's.
**Compared with:** (A) the edition installed in T182 (1/n), `8f30b1e2…`, 477,345 bytes, 47,304 visible words; (B) the intermediate edition you pushed to `main` on 2026-10-17 20:11 NY (`72d88c86…`, 506,542 bytes); (C) the attachment, 77,753 visible words (+64%).

**Verdict.** Nothing that governs was dropped, and the edition is a real improvement in the way it states and tests commitments. Eleven commitments were rewritten; three of them loosen a limit the old text stated, and are worth a deliberate yes (section 4, items 1 to 3). The edition also has index and text defects of its own, which are yours to amend (section 5). No Rule, Principle or Governance Process was removed.

**How it was compared.** The repository's own Charter model (definitions, directory rows, ids, anchors); an alignment of every paragraph; every 8-word run of A that is absent from C (about 2,100 substantive words, 4.5% of A, once the renamed "Playbook" and the replaced Vision-link boilerplate are set aside); a per-definition word diff of all 131 definitions; the 16 tests that read the Charter, run against A, B and C; and a read of every passage the comparison flagged.

## 1. What is preserved

- **Every code:** all 131 codes of A are in C (R-, P- and G-). 25 named defect classes, unchanged. Battles 15 → 19.
- **Governance Processes:** 18 of 18 present. `G-GOVERN-AUTONOMY` (decision authority and agent autonomy, with the four-step number hierarchy and the standing test) is word for word what it was; no words were removed from `OVERRIDE` (amendment), `TRANSITION`, `RAISE`, `SURFACE`, `PROJECT` or the team-role Rules. `G-GOVERN-PRECEDENCE` keeps its order (executable reality, owning specification, durable law, evidence); it names "the historical record" where it named `TIMELINE.md`, and one "Playbook" is left in it (section 5).
- **The historical exemption** from the anti-staleness rule is kept, in the same words, for the Battles Won record, now "Part XI" (it was "Part X, The Curriculum").
- **The chip amendment** of T182 (1/n) is carried: the glossary has Chip † and Answer / response †, and the builder's choices are still not called chips.
- **The Vision, the Foundational Commitments, the three gateways' sections, the Booking Funnel, the formula shape and the pricing registry** are all present (some sections moved: the Booking Funnel and the Document Relationship Map now come early; the pricing sections come late).
- **103 of the 131 definitions keep every word they had** (the edition only adds to them); 17 more differ by whitespace only. Eleven were rewritten (section 4).

## 2. What is stronger

- **Every Rule and Principle now states why it exists and when to revisit it:** an "In plain English" line and a "Rule health & evolvability" block (Vision outcome, Harm prevented, Implementation freedom, Reconsider when, Evidence mechanism) on 119 of them. This is the most important structural gain: a commitment can now be reconsidered by its own terms instead of being preserved or bypassed.
- **Five new Rules:** `R-CLIENT-PRESENTATION-ONLY` (the three gateways own no resolver, confidence engine, pricing or booking logic; equivalent facts give equivalent outcomes), `R-INTAKE-ESCAPE` (every constrained question has an escape and declares its purpose), `R-PRICE-LINEIDENTITY` (a cart line's identity includes every fact its price depends on; its total is amount times quantity, computed in one place), `R-SYSTEM-HOSTS` (every renderer owns its host, none nests or shares one), `R-TEST-SEMANTICDIFF` (a change gate distinguishes semantics from formatting). Four of them came with your 2026-10-17 20:11 NY push; `R-CLIENT-PRESENTATION-ONLY` is new here.
- **`R-PRICE-DURATIONSTATE`** no longer fixes a number in the Charter. The threshold is a policy value; if the minimum-duration estimate is missing or invalid the system may not assume the job is under it; the runtime may not invent an unregistered checkout state. This removes a conflict with the SSOT (the old text said "default sixty").
- **`R-PRICE-SCOPE`** applies per-unit / per-visit scope to fee-bearing modifiers only; a condition modifier that changes minutes, branching or preparation declares its effects and is not treated as a fee. This is the T182 time model written into the law.
- **`R-DOMAIN-DYNCHAIN`**: a diagnostic-first exception must be explicit and still resolve every fact needed for the component and pricing method; a symptom-only chain that leaves component identity unresolved fails publication validation.
- **`G-GOVERN-VISIONLINK`** now covers Principles and says a link that could be copied unchanged onto an unrelated statement is not specific enough.
- **`R-COMPLEX-AXES`** keeps the three axes and "no axis is derived from another", and adds that a dimension may be added or retired only through an explicit, compatibility-aware change.
- **Five broken internal anchors are fixed** (`G-GOVERN-AUTONOMY`, `OVERRIDE`, `PROJECT`, `RAISE`, `SURFACE` had no id): all 190 anchors resolve against 287 ids (was 169 against 221), so `R-INVARIANT-ANCHOR` now passes against the Charter.

## 3. What was made implementation-neutral (nothing lost)

File names (`TIMELINE.md`, `PENDING_DECISIONS.md`, `COMPONENT_LAYER_MAP.md`, `btnyc_schema.json`), function names (`computeUnifiedQuote` and the others in `R-INVARIANT-BOUNDARY`), test file names in the defect-class detector lists, the word "CMS", and the one-HTML-file wording are now role names ("the historical record", "the decision ledger", "the maintained component-responsibility map", "the governed authoring surface"). The risk-tier cut-offs the old text spelled out (ladder under sixteen feet, weights up to fifty pounds, and the rest of R0 to R3) are delegated to "the owning policy and schema"; they live in `policy.complexity_axes.risk_hazards` in the source (18 hazards, each with its tier and meaning), so nothing was lost. The Charter now says it does not freeze names or values.

## 4. Changed in meaning — for your confirmation (filed as #242)

| # | Where | Was | Now | Consequence |
|---|---|---|---|---|
| 1 | `P-CLIENT-THREE` | "Three gateways are the canonical entry architecture… exactly three supported client entry modes: Category Navigation, the 'Other' tile, and SmartQuote. Adding, removing, or redefining a gateway… requires an explicit Charter/specification decision." | "Distinct modes are supported ways for a customer to express intent, and all converge on one canonical engine… governed by its effect on convergence, **not by a fixed gateway count**." | The fixed count and the explicit-decision requirement are gone. `R-CLIENT-PRESENTATION-ONLY` (new) still binds every mode to one pipeline, and its text still says "the three gateways". |
| 2 | `P-GOVERN-DEFECTCLASS` | "The list is append-only: a class is never removed; it may be marked detector shipped or pending." | "The class name and signature remain durable even when the implementation changes." | "Never removed" is no longer stated. |
| 3 | `R-INTAKE-QTYFIELD` | One field, "written by exactly one authoritative code path per entry route", never appearing twice or contradicting itself. | One authoritative quantity fact; displayed, priced and booked quantities stay consistent. | The one-code-path-per-route mechanism is no longer required by the text. |
| 4 | `R-SYSTEM-CMS` | "The CMS Is the Sole Human Authoring Surface"; any temporary direct edit is a bounded dual-source transition under `R-SYSTEM-DUALSOURCE`. | "One Governed Human-Authoring Surface", implementation-neutral, marked "target contract… not a claim that migration is complete". | The dual-source reference is replaced by "the existing transition governance". Our dual-source rule (`R-SYSTEM-DUALSOURCE`) is still in the Charter. |
| 5 | `R-SYSTEM-SCRIPT-SCOPE-IS-REAL` | Script scope while the runtime is one HTML file; tied to `R-SYSTEM-SINGLEFILECOST`. | "Execution scope reflects the chosen deployment boundary"; obligations of a former arrangement are reassessed and retired. | Generalised; the link to the one-file cost Rule is dropped. |
| 6 | `R-INVARIANT-BOUNDARY` | Named the DB paths and engine functions; "narrows the general rule". | Describes them; "operationalizes the Principle"; enforcement may be any mechanism that detects the dependencies. | The test (`verify_r-invariant-boundary_ui_renderer_layer.js`) passes unchanged. |
| 7 | The sixty-minute rule | A job over sixty minutes "may not be presented as a flat-rate card" (default sixty, from policy). | The threshold is "a policy value owned by the authoritative specification". | In your favour: it no longer disagrees with the 30-minute project line in the SSOT. |
| 8 | The live status band | The Charter's page fetched `AGGREGATOR.html` or `charter-status.js` and drew a "Current state" band. | That script is gone (the page's only script is the Reference Index dialog). `G-GOVERN-PROJECT` still says live state is projected from the aggregator, and the document list still names the sidecar. | The Charter no longer draws live status. The T173 sink proofs (`charter_dom_proof.js`) were about that script. |
| 9 | `R-SYSTEM-COMPOSER` | "The Composer Is a Renderer; the Parser Is Not" | "The Sentence Renderer Is Not a Parser" | Retitled. |
| 10 | `R-CONF-ACCOUNTING` | Names the `confidence_gain` field. | "legacy confidence-gain metadata". | Abstracted. |
| 11 | `R-COMPLEX-AXES` | "Every Service Declares Three Orthogonal Properties". | "Complexity Dimensions Remain Orthogonal and Explicit"; the vocabulary is "present core dimensions". | See section 2. |

**Items 1 to 3 are the ones I would read twice:** they loosen a stated limit (a gateway count, a never-removed register, a single code path). Each reads as deliberate, and none changes a price or a test result.

## 5. Defects in the edition (yours to amend; I have not edited the file)

1. **Directory.** `R-CLIENT-PRESENTATION-ONLY` is defined but not in the directory. `R-INTAKE-ESCAPE`, `R-PRICE-LINEIDENTITY`, `R-SYSTEM-HOSTS` and `R-TEST-SEMANTICDIFF` are listed in the Principles table. `R-COMPLEX-AXES`, `R-SYSTEM-CMS` and `R-SYSTEM-SCRIPT-SCOPE-IS-REAL` are defined by a heading with an id, but not by the definition span the other Rules use, so the index model reports "no section defines it". (`verify_charter_rules.js`: 24 problems before; 27 now: 5 fixed, 8 new. The two older ones remain: `G-GOVERN-PRECEDENCE` in the Rules table, `R-INVARIANT-DONE` in the Principles table.)
2. **Generated text.** 76 of the 119 "Harm prevented" lines are one template ("If this commitment is absent or bypassed, <the outcome, restated> can fail; the resulting harm is a mismatch…"), which names no concrete harm, though `G-GOVERN-VISIONLINK` requires one. 115 "Vision outcome protected" lines end with the same sentence, and many repeat the Accomplishment line word for word; 118 "Reconsider when" lines are identical.
3. **Leftovers.** Four "Playbook" remain (the evidence line of `G-GOVERN-PRECEDENCE`, the cross-reference sentence of `R-INVARIANT-ANCHOR`, and twice in Document History); one sentence reads "the derived runtime artifact is the derived runtime artifact the engine consumes"; `R-SYSTEM-HOSTS` carries both the old Vision-link line and the new block.
4. **Repetition.** The same sentence appears three or four times inside one Rule (for example `R-SYSTEM-CMS`: the statement, the target-contract note, the health block). Copies of a normative sentence can drift apart.

## 6. Effect on the repository

- **Installed byte for byte** (`PROJECT_CHARTER.html`, sha256 `a56379db…`).
- **The 16 tests that read the Charter, run against A, B and C:** identical results except (a) `verify_complexity_axes.js`, which read the old spelling of the R-COMPLEX-AXES declaration (`risk_tier:`, `batch_risk_compounds:`) and threw; it now accepts the new spelling (`risk classification:`, `batch-risk flag:`), still fails on a missing or different enumeration, and is 51 of 51; (b) the counts in `verify_charter_rules.js` and `verify_charter_rule_index_v10.js` (the problems listed in section 5; v10 goes 23 → 21 failures because the anchors now resolve). The five tests that were already red are red with the same counts.
- **Prices:** the golden master on the merged tree, 0 of 2,988 points differ from `archive/golden_master_T182.json`.
- **Data checks:** `report.js`, `publish.js`, `project_legacy.js`, `carry_charter.js` (`--check`), `validate_source.js` and `verify_charter_carry.js` pass.


## Update (T185, 2026-10-23, after the re-amended edition of 2026-10-22 22:00 NY)

This review describes the edition attached on 2026-10-22 20:36 NY (sha256 `a56379db…`). You re-amended the Charter and attached the new edition (`0a28f572`, sha256 `8a6f5f41…`, 742,868 bytes), now installed unedited as `f73589ca`. What changed for this review:

- **Section 4 / #242 (the eleven rewritten commitments).** All three loosenings are retained verbatim, and the "no fixed gateway count" generalisation now reaches about ten further places. #242 is resolved by the edition.
- **Section 5 / #241 (defects of the edition).** Fixed in the new edition: the three heading-only Rules (`R-COMPLEX-AXES`, `R-SYSTEM-CMS`, `R-SYSTEM-SCRIPT-SCOPE-IS-REAL`) are defined; the four Rules in the Principles table and the `G-GOVERN` Rules in the Rules table are in their own tables, without duplicate rows; "Playbook" 4 → 0; the 76 template Harm lines and 115 boilerplate sentences are gone; `R-SYSTEM-HOSTS` carries one block. `verify_charter_rules.js`: 27 → 11 problems.
- **Still open (five):** `R-CLIENT-PRESENTATION-ONLY` is defined but not in the directory; one sentence in Document History repeats itself; three references are written as definitions (`G-INVARIANT-DETECTOR` twice, `R-INVARIANT-PROVENANCE`); the Harm lines are fifteen category templates (seven written for one rule), 26 Rules lost a specific hand-written harm line and several now carry another rule's harm; seven of my tests' `@enforces` lines name a Principle.
- **Sections 1 to 3 and 6** (what is preserved, strengthened, made neutral; effect on the repository) stand: nothing that governs was dropped between the two editions, and no test, price or label changed. The current record is `PENDING_DECISIONS.md` #241 and #242, and `TIMELINE.md` T185 (1/n).


## Update (T188, 2026-10-23, after the revision of 2026-10-22 23:05 NY)

You revised the Charter again to address the open items of #241 (attachment `612891ec`, sha256 `b7ba1098…`, 720,626 bytes), now installed unedited as `04ed8c37`. Measured against the edition before it (136 definitions to 136; a whole-document 8-gram comparison for lost text, 117 paragraphs, all accounted for):

- **Fixed:** `R-CLIENT-PRESENTATION-ONLY` is in the directory (136 rows); the repeated Document History sentence is gone; the 116 templated "Harm prevented ... The specific commitment at risk is:" lines are replaced by lines written for their rules (118 paragraphs before and after, none dropped), including the rules that had carried another rule's harm (`R-WHITEFLAG-FORKB`, `R-INVARIANT-REDTEST`, `R-SYSTEM-DEPLOYORDER`).
- **Mine, done:** my tests' `@enforces <Principle>` tags are now prose lines; `verify_charter_rules.js` reports 3 problems (27 → 11 → 3).
- **Still open (one):** `G-INVARIANT-DETECTOR` (twice) and `R-INVARIANT-PROVENANCE` are written as definitions but are references. It blocks nothing.
- **Sections 1 to 3 and 6** still stand: nothing that governs was dropped, and no test, price or label changed. The current record is `PENDING_DECISIONS.md` #241 and `TIMELINE.md` T188 (1/n).
