# Service naming: one scope, one name (T188)

The Charter ("Naming From Scope") says a client-facing service name "should render its scope clearly, often as **[Object] + [Qualifier] + [Action]**", that "the same scope produces the same name regardless of whether the client arrived via Gateway A, B, or C", and that "the name must not stutter". Names used to be typed by hand, one string per service, and the confirmation sentence then recovered its noun and verb by running a regex over that string. Every quirk of a title reached the sentence ("I need 1 Faucet Repair (Drip) repaired").

Now every curated service **authors its scope once**, and the name, the title and the sentence's verb are **derived** from it. The words come from a vocabulary that lives in the SSOT too, so nothing about naming is in code.

## Where it lives

| What | Where |
|---|---|
| the scope a service authors | `ssot/btnyc_source.json`, `entities[].services[].presentation.ui_taxonomy.naming` (mirrored to `btnyc.json` `services[].ui_taxonomy.naming`) |
| the vocabulary (action nouns, past participles, lowercase words, qualifier prepositions, tails) | `policy.ui_config.service_naming` (mirrored to `ui_config.service_naming`) |
| the composer, the checks, the deriver | `test_harness/tools/entity_first/service_naming.js` |
| the gate that refuses a source with a naming defect | `validate_source.js`, as `V-NAME-<CODE>` (so `publish.js` refuses it) |
| the test | `test_harness/verify_service_naming.js` |
| what reads it at run time | `sqBuildAdlib` (the sentence's noun and verb) and `affirmJobPhrase` (the confirmation card's "a ... job") in `qr.html` |

## The grammar

```
"naming": { "object": "Faucet", "qualifier": "Drip", "actions": ["repair"],
            "tail": "buy_the_hour"?, "entity_note": "..."?, "exception": { "display_name": "...", "reason": "..." }?,
            "name": "Faucet Drip Repair" }        // name is DERIVED; everything else is authored

name         = [Object] [Qualifier] [Action nouns joined by " or "]
               a qualifier that begins with a preposition (with, for, from, in, under, without, on, at) follows the action:
               "Flatscreen Mounting with Hidden Cables", "Furniture Disassembly for Moving"
display_name = name + " " + tail text          the title on a tile; the only place a presentation extra may appear ("⏰ Buy-the-Hour")
verb_natural = past participle of the first action     "repaired", "mounted", "set up"; the sentence reads "I need 1 Faucet repaired"
```

The Charter's own worked names come out exactly: `[Sink] + [Drip-Leak] + [Repair]` is "Sink Drip-Leak Repair"; `[Flatscreen] + [Mortar] + [Mounting]` is "Flatscreen Mortar Mounting"; `[Door Deadbolt] + [Install]` is "Door Deadbolt Install". The same scope gives the same name every time, whichever gateway the client came by.

## What the validator holds (each can fail, each has a mutant)

| code | the rule |
|---|---|
| `VOCAB` | the vocabulary is whole: every action has a noun and a past participle |
| `MISSING` | every curated service authors a scope |
| `PARTS` | only known keys; only actions in the vocabulary; no action twice |
| `CHARS` | no pipe, slash, bracket, parenthesis, ampersand or emoji in a part (a title carries presentation only through a tail) |
| `CASE` | words are capitalised except the lowercase words ("or", "for", ...) |
| `STUTTER` | no word twice in a row, and the object does not end in its own action's noun ("Repair Repair") |
| `STALE` | name, title and verb are exactly what the scope composes |
| `UNIQUE` | no two services share a name or a title |
| `MODIFIER` | a service that carries a domain modifier names the condition (a qualifier) |
| `ENTITY` | the customer's noun shares a word with its entity or its aliases; if it does not, `entity_note` says why (and an `entity_note` on a name that does share a word is itself a finding) |
| `TAIL` | a tail that names a pricing type is used only on a service priced that way |
| `EXCEPTION` | an exception needs a written reason and must actually differ from the composed title |

## Exceptions

"It should still be a clear name of what the service is in the Client's language and not jargon, so there may be some exceptions to the presentation." There are two honest exceptions, and both are recorded in the data instead of being allowed by default:

* `exception: { display_name, reason }` shows a title that is not the composed name. The name stays composed (so identity and matching are unchanged), the reason is mandatory, and an exception that excepts nothing is refused. **No service uses it today.**
* `entity_note` says why the customer's noun is not their entity's. Two services use it: "Wall Hole or Crack Repair" (the entity is drywall; the customer says "wall") and "System Restore or Reset" (the entity is the operating system; the customer says "system", as in Windows' own System Restore).

## How to add or rename a service

1. Author the scope in the source: `object`, `qualifier` (only if a modifier or a distinguishing condition needs naming), `actions`, `tail` (only for hourly-priced services), and an `entity_note` only if the noun differs from the entity.
2. `node test_harness/tools/entity_first/service_naming.js --write` derives `name`, `display_name` and `verb_natural` in the source.
3. `node test_harness/tools/entity_first/service_naming.js --patch F.json`, then `ssot_patch.js` for the mirror, then the usual `carry_charter.js --write`, `splice_compiled.py btnyc.json --write`, `publish.js`, `report.js --write`.
4. `service_naming.js --check` and `verify_service_naming.js` must be green. A hand-typed title is refused (`STALE`): change the scope, not the string.

To change the words (a new action, a different past participle) edit `policy.ui_config.service_naming` and derive again; nothing in code changes.

## What changed on the first application (76 services)

15 titles and 18 verbs were corrected; 61 titles were already their composed names. The old phrase a customer would type for any of the 15 still routes exactly as before (30 phrases, held by `verify_service_naming.js` section 3b against `archive/golden_master_T182.json`). See `archive/golden_change_T188_service_naming.md` and `PENDING_DECISIONS.md` ("Autonomy decisions (T188 (2/n))") for every old and new string.

| service | was | now |
|---|---|---|
| `faucet_repair_drip` | Faucet Repair (Drip) | Faucet Drip Repair |
| `flatscreen_mounting_standard` | Flatscreen Mounting (Standard) | Flatscreen Mounting |
| `furniture_assembly_flat_pack` | Furniture Assembly Flat-Pack | Flat-Pack Furniture Assembly |
| `stove_repair` | Stove / Range Repair | Stove or Range Repair |
| `generic_mounting_service` | Wall Mounting (any item) | Wall Mounting for Any Item |
| `door_repair_impact_damage` | Door Repair Impact Damage | Door Impact-Damage Repair |
| `leak_under_sink_repair` | Leak Under Sink Repair | Under-Sink Leak Repair |
| `high_ceiling_bulb_replacement` | High Ceiling Bulb Replacement | Light Bulb Replacement in High Ceilings |
| `scratch_or_water_ring_removal` | Scratch or Water Ring Removal | Scratch or Water Ring Removal from Furniture |
| `router_configuration` | Router Configuration | Router Setup |
| `smart_plug_configuration` | Smart Plug Configuration | Smart Plug Setup |
| `blinds_shades_curtains_buy_the_hour` | Blinds\|Shades\|Curtains ⏰ Buy-the-Hour | Blinds, Shades or Curtains Install ⏰ Buy-the-Hour |
| `furniture_repair_hourly` | Furniture Repair ⏰Hourly | Furniture Repair ⏰ Buy-the-Hour |
| `shelf_mortar_mounting_buy_the_hour` | Shelf Mortar Mounting ⏰Buy-the-Hour | Shelf Mortar Mounting ⏰ Buy-the-Hour |
| `shelf_mounting_standard_buy_the_hour` | Shelf Mounting Standard ⏰Buy-the-Hour | Shelf Mounting ⏰ Buy-the-Hour |

The verbs that changed are the ones the old guesser got wrong: "Furniture Disassembly for Moving" was "assembled" (now "disassembled"); "Slow Drain Clearing" was "cleaned" (now "cleared"); the mounting services were "installed" (now "mounted"); the configuration and setup services were "configured" (now "set up"); and so on.

## Not done here (named so they are not lost)

* **Dynamic services have no name.** A dynamic service (composed at run time from an entity and an action) is named by `affirmJobPhrase` cleaning words. A shared run-time composer that reads the same vocabulary would make a curated and a dynamic service of the same scope say the same thing.
* **Entity labels are not authored by this mechanism.** Some are auto-derived and read poorly ("Gfci outlet", "Os", "Tv"); the object in a scope is authored independently, so the sentence does not use them, but the entity label still shows where an entity is named directly.
* **A finer action grain** would separate the three decomposition points still open in #209 (the fine action is already authored as `actions[]`; nothing reads it for that yet).
* `ui_config.badge_labels` is read by code but not defined in the SSOT (a literal fallback runs); unrelated to naming, noticed on the way.
