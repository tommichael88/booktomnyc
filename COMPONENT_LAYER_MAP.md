# BTNYC Component / Layer Map

**Status:** Target responsibility map, not a claim that the current codebase has completed this decomposition.  
**Authority:** The Playbook defines durable ownership rules. This file names the current target module boundaries and may change as the implementation is migrated.  
**North Star:** one canonical domain understanding; one owner per concern; the Glue sequences responsibilities without absorbing them.

## The target modules

| Module | Primary responsibility | Owns | Must not absorb |
|---|---|---|---|
| `resolver.js` | Resolve current facts and evidence into the canonical domain interpretation | Resolution of `BookingContext`, branch/state consequences, provenance | Confidence arithmetic, question-chain composition, pricing policy, UI behavior |
| `confidence_engine.js` | Measure uncertainty retirement against the applicable authored profile and policy | `Cᵢ` / `Cₓ` calculations, open/retired uncertainty accounting, confidence thresholds as consumed policy | Choosing the next question, resolving facts, pricing calculations |
| `composer.js` | Compose valid question sequences from entity scope, dependencies, and available evidence | Question-chain composition and eligibility | Confidence measurement, final route selection, price computation |
| `route_builder.js` | Select an honest quote route from resolved state and confidence | Exact / range / conditional / diagnostic route construction | Re-resolving facts, duplicating confidence math, UI rendering |
| `pricing_engine.js` | Calculate the fee from resolved work and explicit pricing rules | Price formulas, modifier application, per-unit/per-visit semantics | Confidence calculation, recovery composition, caller-side arbitration |
| `nlp_engine.js` | Interpret free text into candidate entities, actions, modifiers, and evidence | Language parsing and candidate extraction | Final resolution authority, pricing, confidence arithmetic |
| `cart_logic.js` | Maintain cart/service selections and quantities as customer-facing work items | Cart aggregation and quantity state within its contract | Re-resolving domain facts, recalculating confidence, redefining pricing rules |
| `orchestrator_engine.js` | Coordinate the workflow and sequence domain operations | Call order, transition orchestration, trace assembly | Owning the internal calculations of resolver, confidence, composer, route builder, or pricing |
| `UIRenderer.js` | Render state into interface elements | Presentation of supplied view state | Business decisions, inference, pricing, confidence, recovery selection |
| `AppController.js` | Bind UI events to application commands | Event wiring and user interaction lifecycle | Domain calculations or duplicated policy |
| `store.js` | Provide the canonical state access boundary | State access API and subscriptions as currently contracted | Independent shadow state or business interpretation |
| `appReducer.js` | Apply deterministic state transitions | Reducer transitions for declared actions | I/O, rendering, pricing, confidence, or hidden orchestration |
| `trace.js` | Capture and format an execution trace of the workflow | Trace events, spans, and diagnostic payloads | Business decisions, pricing, confidence arithmetic, resolution authority |
| `recovery_engine.js` *(proposed responsibility; file name may be assigned during implementation)* | Choose the next useful evidence path from current open uncertainty | Recovery candidate selection and recovery affordance decisions | Question-chain composition mechanics, confidence measurement, resolver mechanics |

## Note on the thirteen-module target

The requested target names list twelve module targets plus the recovery responsibility, which is a distinct Logic concern that does not yet have a named module in the supplied list. The implementation may either introduce `recovery_engine.js` or assign the responsibility to an existing module only if that module's primary responsibility is deliberately redefined and the resulting boundaries remain coherent. Do not silently place recovery selection inside `composer.js` or `confidence_engine.js` merely because they are adjacent in the call path.

## Responsibility flow

```text
Customer text / picker / guided intake
                 |
                 v
            nlp_engine.js (when needed)
                 |
                 v
          resolver.js <---- authored entity graph + evidence
                 |
        +--------+----------------+
        |                         |
        v                         v
confidence_engine.js         composer.js
        |                         |
        +------------+------------+
                     v
             recovery_engine.js
                     |
                     v
              route_builder.js
                     |
          +----------+----------+
          |                     |
          v                     v
   pricing_engine.js       cart_logic.js
          |                     |
          +----------+----------+
                     v
           store.js / appReducer.js
                     |
                     v
          AppController.js → UIRenderer.js
```

This diagram is a responsibility guide, not a mandatory literal call graph. `orchestrator_engine.js` is the Glue: it sequences the calls shown here and owns no computation of its own, so it is omitted from the linear flow. The resolver's output and the current `BookingContext` remain authoritative; callers must not arbitrate with `||`, `??`, or inline re-derivation.

## Entity-first SSOT contract consumed by the modules

The source model organizes knowledge around customer-named entities. Shared actions and modifiers have stable IDs and canonical definitions. Each entity declares its applicable questions and uncertainty classes and its curated service combinations. Each service declares its entity/action/modifier combination, pricing shape, applicable uncertainty profile, confidence policy, and recovery affordances. Each question declares entity scope and first-class dependencies. Each option declares actual downstream effects.

The module boundaries consume projections of this same graph; they do not each invent a separate source shape:

- Resolver consumes entity/action/modifier relationships, evidence, option effects, and dependencies.
- Confidence engine consumes the service's applicable uncertainty profile and retirement evidence.
- Composer consumes scoped questions and explicit dependencies.
- Recovery engine consumes current open uncertainty and the set of evidence paths that can retire it.
- Route builder consumes resolved state and confidence, then chooses a supported route.
- Pricing engine consumes resolved work and explicit pricing rules.
- UI renders decisions returned by Logic; it does not reconstruct them.

## Ownership test

When adding or changing behavior, answer these questions before implementation:

1. What domain concern is this?
2. Which module owns that concern's meaning and canonical computation?
3. Which authored SSOT relationship supplies its business facts?
4. Which other modules merely consume the result?
5. What check demonstrates that the owner—not a caller-side copy—made the decision?

If a new change cannot answer those questions, stop and correct the responsibility map or the source model before adding another branch or fallback.
