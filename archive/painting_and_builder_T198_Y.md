# T198 Y — painting is not a lighting job; the builder and free text decide the same thing (2026-11-25)

## Y1. Understood work outside the offering
Customer problem: "paint the walls light gray" showed "Legacy flow" ("light" read as lighting); "paint my bedroom", "repaint the ceiling", "paint the door light blue" were silently quoted as Minor Home Repairs ($70) — another trade in painting's place.

Three conditions are now distinct: a supported service (priced); an ambiguous request (asked, X1); an understood request outside the offering (said so: no price, no Add, nothing substituted). Owner: authored `global_rules.unsupported_trades` (painting; its words and the words that make a phrase something else: patch, hole, crack, drywall, touch up, peeling, hang/mount, picture/frame/artwork, "myself"); `orch_unsupported_trade` reads it (same whole-word matcher as the hazard stops, now `orch_authored_stop`); the route carries `unsupportedTrade`; `renderRoute` and `sqUnifiedAction` answer it. "Light" was never added to any list: the request is answered as painting before any lighting reading can price it. Nothing is priced, so no authored price exists for painting (R-PRICE-PRECISION: no evidence is not an authorised service).

Found on the way: a stop/unsupported panel stayed on screen under the next request's builder questions (also true of W's hazard stops); a new request now clears it.

## Y2. Builder and free text, one decision
Trace for "fix light" -> won't turn on -> bathroom: customer words -> `understandRequest` seeds the builder with the object's category and keyword (`electric_lighting`, "light fixture") but no group -> `sqBuilderFinish` priced the category's default scope (base $0, 45 min skilled + $45 dispatch = $64 "light repaired") without ever asking the orchestrator; typed "light wont turn on" reaches the orchestrator, whose veto (held ambiguous word, X1) asks which lighting job. First divergence: `sqBuilderFinish` never consulted the resolution the builder's own comment says it shares. Fix: `orch_builder_unresolved` (Logic, orchestrator block) = the composed sentence of a group-less builder session is vetoed by the shared resolution; `sqBuilderFinish` then hands the sentence to `sqAnalyze` (the same question). A session naming its group, or a sentence that resolves, is unchanged (the builder keeps the chosen count).

Scope note: `fix curtains` etc. never reach the builder (understood complete); the divergence class is the vetoed one.

## Evidence
- `verify_unsupported_trade_painting.js` (29: engine, real page, non-vacuity) and `verify_builder_defers_to_resolution.js` (13: engine, page both paths, identical choices, non-vacuity with the deferral disabled prices $64).
- Price golden master, fresh `main` worktree vs branch (modules regenerated on both): 0 of 2,988 differ, after Y1 and after Y2.
- `verify_light_window_furniture_routes.js` 40/40 and `verify_gas_safety_stop.js` 44/44 (the protected 65-phrase batch and the hazard stops).
- Generated artifacts regenerated (`migrate_legacy`, `carry_charter`, `publish`, `report`, `extract_modules`; all `--check` pass).
