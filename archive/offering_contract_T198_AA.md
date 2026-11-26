# T198 AA — a service authored later must reach every consumer through the catalog alone

Structural-change record (Charter structural-change governance: current defect, target shape, transition boundary, measurable closure condition). Content and structure are separated below.

## Findings (what existed, against R-INVARIANT-SOURCE / R-INVARIANT-CANONICAL / P-SYSTEM-CLASSIFY-ONE / P-INVARIANT-PROPAGATE)
1. **Confirmed break: a second eligibility classifier.** Y1/Z1 declined painting through `global_rules.unsupported_trades` (its own phrase patterns, its own title/message). A painting service authored later would be routed and priced by the engine while the renderer, reading the rule list, would still decline the same words. Traced with a data-only painting service (`/tmp` fixture, rule kept): routed at $60 and declined on the page.
2. **Partial break: the guided builder.** NLP picked up an authored action automatically (`statedStype` became "Replace" in a fixture), but the builder's action choices were a seven-row code constant (`BLD_ACTION_MAP`), so an authored action never appeared there.
3. **Authoring `act.replace` is data-only** (`registries.actions` + `action_vocabulary.actions`; the unmapped "replace" entry removed) — except that the **runtime schema closed the set of service types** (`schema/btnyc_schema.json` `service_types` pattern `^(Assembly|…|Setup)$`), so the compiler rejected a new type. A closed enum duplicating an authored registry.
4. **Partial scope** (touch-up paint inside a patch) had been inferred from a material id in code (`MAT-MSC-PaintTouchUp`); it was a text pattern, not authored coverage.
5. **Safety is independent of eligibility.** `route.safetyStop` is set by `orch_safety_stop` and read first by the renderer; no authored service can bypass it (tested with a service present).

## Target shape (R-SYSTEM-CMS) and what was changed
Five facts stay distinct and each has one authored home:
- **Requested intent** — the customer's verb/object; `statedStype` (kept from Z2) and now `statedNotOffered` (a not-offered verb).
- **Capability** — an authored action + service type (`act.*`, `service_types`).
- **Eligibility** — a service/entity exists for the object. Declined only when the verb is authored as `offering.status:"not_offered"` and no mapped action claims it; the moment the verb becomes a mapped action the decline stops (no rule to remove).
- **Scope coverage** — authored `offering.partial_coverage[{service_id, note}]` on the verb; the notice names what the service covers (touch-up of the repaired spot only) and never implies a whole-wall job.
- **Pricing authorization** — unchanged: only a service's own contract prices.

Changes (structural, no content change to prices):
- `global_rules.unsupported_trades` deleted; the painting decline is the authored `offering` on the verb "paint" (`vocabulary.action_vocabulary.unmapped_verbs`). `orch_unsupported_trade` derives from `context.statedNotOffered` only; NLP `_detectStatedAction` (one detector, replaces `_detectStatedStype`) returns the stated type and the not-offered verb, with a same-position shadow rule so a mapped verb beats a declined one.
- Validator: `V-OFFER-SHAPE`, `V-OFFER-SHADOW` (a verb both offered and not offered), `V-OFFER-DANGLING` (partial coverage naming a service that does not exist), each with a counterfactual mutant (212 validator checks, 181 mutants over 74 codes). A contradictory authored change fails validation with the verb named.
- Builder: `bldActionMap()` = the legacy rows plus one derived row for every authored service type that has a customer verb. Authoring an action reaches the builder with no edit to `qr.html`.
- Runtime schema: service-type keys accept any capitalised name (`^[A-Z][A-Za-z]*$`); the cross-reference (a type has a conjugation; a service names a real type) is carried by the validator and the compiler's own checks.
- Content: `act.replace` authored (base $65, skilled, `item_quantity`) with conjugation (replace / swap / change out); the unmapped entry removed. Every replace phrasing keeps its service and price; the route now carries `requestedAction: "Replace"`.

## Transition boundary and closure condition
Dual-source (`ssot/TRANSITION_DUALSOURCE.md`) is still in effect: this change is patched in `ssot/btnyc_source.json` and `btnyc.json` and checked by `project_legacy --check`; R-SYSTEM-CMS is **not** a completed state. Bounded legacy exceptions left standing: the seven static `BLD_ACTION_MAP` rows (labels/icons the catalog cannot yet author), the Install↔Mount and Repair→Diagnostic fallbacks in `resolveDynamicService`. **Closure:** the static rows and fallbacks are removed when the action registry authors label, icon and fallback type and `verify_offering_activation_contract.js` passes with `BLD_ACTION_MAP` empty.

## Counterexample (the future-service activation test)
`verify_offering_activation_contract.js` (24): shipped catalog declines painting (no price); a data-only painting service (mapped action, service type, service, group, object, entity, artwork noun) is routed at its authored $60 on free text, shown in the builder as a Paint action and in the catalog group, still stops first for a gas hazard, and does not capture "hang a painting"; the fixture removed, the decline returns; a source authoring "paint" both ways fails `V-OFFER-SHADOW`; `act.replace` keeps every replace route and price.

## Measured
Price golden master (2,988 points) vs `main` `f0e2699`: 0 differ, before and after authoring `act.replace`. Replace phrasings (faucet, light fixture, toilet seat, door handle, smoke-alarm battery, lock, sink): same service and price on `main` and the branch.

## Not done (tried, measured, reverted) — the sink variants
- A generic "replace" object modelled on "install" would have routed "replace the sink" to a general intake, but regressed "replace smoke alarm battery" and "replace the lock" from a curated $70 card to a legacy flow. Reverted.
- Adding "hook" to the mounting object fixed "put a hook under the sink" (was Angle Stop Replacement $60) but moved "hang a hook on the wall" $60→$75, "fix a hook that fell off" repair→mount, and "fish hook" to a mount price. Mixed outcomes, no evidence for the price: reverted.
- "Replace the sink" (Faucet Drip Repair $50) and "put a hook under the sink" stay recorded; both need a content decision (is a sink replacement offered; a hook object with its own service and price), not engine code.
