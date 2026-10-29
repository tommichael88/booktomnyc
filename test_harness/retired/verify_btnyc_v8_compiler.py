#!/usr/bin/env python3
"""
verify_btnyc_v8_compiler.py

Regression test for btnyc_v8_compiler.py, which splits the previously-
overloaded "archetype" concept into two genuinely separate, real
namespaces (routing_archetypes vs. pricing_archetypes) per direct
request, and fixes a real, small classification bug (dmg_size, a
severity/scope module, was incorrectly counted as a symptom module)
found while verifying the proposed threshold against the real,
complete, corrected data.

v9.6 FIX (T55): this file's own field-name and count assertions had
gone stale relative to the compiler's real, current output and, in one
case (tech_trouble_computer_repair), directly contradicted
classify_routing_archetype's own docstring -- confirmed via direct
check of the live data and the compiler's own documented reasoning
before updating, not assumed. Also extended with the actual point of
T55's fix: routing_archetypes previously used different field names
than every real consumer reads (real_components/real_actions_in_group/
etc. vs. the live real_component_ids/real_action_ids/etc.) and
overwrote hand-curated live content wholesale on every run -- both
confirmed severe enough that applying this compiler's output directly
would have returned structurally empty data to every group's picker at
once, and separately, silently erased real, hand-authored content for
12 of 38 groups. Fixed: field names now match; existing, hand-curated
content is preserved outright when present (not merged with a fresh
pass, after directly confirming the fresh pass's own component
extraction has a real, separate quality problem -- attribute-style
modules like mounting_height/weight producing non-component answer
labels as if they were real components). The new, permanent guarantee
this file now locks in: a fresh compile against the live catalog
produces routing_archetypes that is genuinely value-equivalent to what's
already live -- the compiler is safely re-runnable again, not just
believed to be.
"""
import json
import subprocess
import sys
import tempfile
import os

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

pass_count, fail_count = 0, 0


def check(label, condition):
    global pass_count, fail_count
    if condition:
        pass_count += 1
        print(f"  ✓ {label}")
    else:
        fail_count += 1
        print(f"  ✗ {label}")


with tempfile.TemporaryDirectory() as tmpdir:
    output_path = os.path.join(tmpdir, "compiled.json")
    print("=== Running the real, complete v8 compiler against the live, current btnyc.json ===")
    result = subprocess.run(
        ["python3", os.path.join(REPO_ROOT, "btnyc_v8_compiler.py"),
         os.path.join(REPO_ROOT, "btnyc.json"), output_path],
        capture_output=True, text=True,
    )
    check("the real compiler runs to completion with exit code 0", result.returncode == 0)

    with open(output_path) as f:
        compiled = json.load(f)
    with open(os.path.join(REPO_ROOT, "btnyc.json")) as f:
        live = json.load(f)

    print("\n=== The real, two-namespace split is genuinely present ===")
    check("routing_archetypes exists as its own, real, top-level namespace", "routing_archetypes" in compiled)
    check("pricing_archetypes exists as its own, real, top-level namespace", "pricing_archetypes" in compiled)
    check("the old, merged group_archetypes key is genuinely gone", "group_archetypes" not in compiled)

    print("\n=== T55: field names now match what every real consumer actually reads ===")
    sample = next(iter(compiled["routing_archetypes"].values()))
    check("real_component_ids (not real_components) is the real field name", "real_component_ids" in sample)
    check("real_action_ids (not real_actions_in_group) is the real field name", "real_action_ids" in sample)
    check("real_symptom_ids (not real_symptoms) is the real field name", "real_symptom_ids" in sample)
    check("component_id_to_service_ids (not component_to_service_ids) is the real field name", "component_id_to_service_ids" in sample)
    check("symptom_id_to_service_ids (not symptom_to_service_ids) is the real field name", "symptom_id_to_service_ids" in sample)

    print("\n=== T55: the compiler is now genuinely, safely re-runnable -- fresh output matches live data exactly ===")
    live_ra = live["routing_archetypes"]
    fresh_ra = compiled["routing_archetypes"]
    check("every real group present in live data is present in a fresh compile", set(live_ra.keys()) == set(fresh_ra.keys()))

    label_diffs = [gid for gid in live_ra if live_ra[gid]["routing_archetype"] != fresh_ra[gid]["routing_archetype"]]
    check(f"zero routing_archetype label differences between live and fresh (found {len(label_diffs)}: {label_diffs})", len(label_diffs) == 0)

    regressions = []
    pollution = []
    for gid in live_ra:
        l_comp, f_comp = set(live_ra[gid].get("real_component_ids", [])), set(fresh_ra[gid].get("real_component_ids", []))
        l_symp, f_symp = set(live_ra[gid].get("real_symptom_ids", [])), set(fresh_ra[gid].get("real_symptom_ids", []))
        if (l_comp - f_comp) or (l_symp - f_symp):
            regressions.append(gid)
        if (f_comp - l_comp) or (f_symp - l_symp):
            pollution.append(gid)
    check(f"zero groups lose real, hand-curated content on a fresh compile (found {len(regressions)}: {regressions})", len(regressions) == 0)
    check(f"zero groups gain unreviewed 'new' content on a fresh compile (found {len(pollution)}: {pollution}) "
          "-- confirmed directly this session that a straight union-merge would have polluted curated data with "
          "non-component answer labels from attribute-style modules (mounting_height, weight, etc.); existing "
          "content is preserved outright instead, not merged",
          len(pollution) == 0)

    print("\n=== 'parent' groups (a concept this compiler has no independent way to derive) are preserved exactly ===")
    parent_groups = [gid for gid, v in live_ra.items() if v.get("routing_archetype") == "parent"]
    check(f"exactly 2 real groups are classified 'parent' in live data (found {len(parent_groups)})", len(parent_groups) == 2)
    check("every 'parent' group's full entry survives a fresh compile byte-for-byte",
          all(fresh_ra[gid] == live_ra[gid] for gid in parent_groups))

    print("\n=== Both real, originally-discussed examples classify exactly as this compiler's own docstring documents ===")
    tech = compiled["routing_archetypes"]["tech_trouble_computer_repair"]
    doors = compiled["routing_archetypes"]["minor_home_repairs_doors"]
    check("tech_trouble_computer_repair correctly classifies as symptom_first, matching classify_routing_archetype's "
          "own docstring (\"tech_trouble_computer_repair -> symptom_first at a real 0.47 ratio\") -- the prior version "
          "of this test asserted component_first, directly contradicting that docstring; confirmed against both the "
          "docstring and live data before correcting, not assumed",
          tech["routing_archetype"] == "symptom_first")
    check("minor_home_repairs_doors correctly classifies as component_first", doors["routing_archetype"] == "component_first")

    print("\n=== Real, small classification bug (dmg_size) found and fixed while verifying -- still holds, now via preservation ===")
    walls = compiled["routing_archetypes"]["minor_home_repairs_walls"]
    check("minor_home_repairs_walls' real_symptom_ids is genuinely empty (the dmg_size fix's own result, now preserved from live data rather than re-derived fresh)", walls["real_symptom_ids"] == [])
    check("minor_home_repairs_walls correctly stays component_first", walls["routing_archetype"] == "component_first")

    print("\n=== Real, honest 'undetermined' classification for groups with zero signal either way ===")
    undetermined = [gid for gid, ra in compiled["routing_archetypes"].items() if ra["routing_archetype"] == "undetermined"]
    check(f"exactly 1 real group is honestly marked undetermined in the live, current catalog (found {len(undetermined)}) "
          "-- down from 3 as of this session's own dryer/stove_range authoring (real, physically-grounded "
          "symptom_first classification, using the same shared symptom module as washer/dishwasher/refrigerator) "
          "-- only minor_home_repairs_appliances_other remains genuinely undetermined, a real catch-all with no "
          "specific appliance identity to classify",
          len(undetermined) == 1)
    check("no group is ever forced into component_first/symptom_first with zero real, supporting data",
          all(compiled["routing_archetypes"][g]["real_component_ids"] == [] and compiled["routing_archetypes"][g]["real_symptom_ids"] == [] for g in undetermined))

    print("\n=== pricing_archetypes correctly, centrally defines all 5 real, schema-confirmed archetypes ===")
    pa = compiled["pricing_archetypes"]
    check("all 5 real archetypes are present", set(pa.keys()) == {"flat_simple", "hourly_timed", "diagnostic_open", "tiered_per_unit", "formula"})
    check("tiered_per_unit is correctly, currently empty (cabinet_knob_or_pull_install, its one-time candidate, "
          "carries an explicit, documented pricing_archetype override to hourly_timed since v9.5.14 -- a real, "
          "confirmed bug in computeArchetypeQuote's own tiered_per_unit branch, not a wrong pricing model for "
          "this service -- so the compiler correctly no longer places it here)",
          pa["tiered_per_unit"]["currently_assigned_to"] == [])

    print("\n=== T67: pricing_archetypes verified live and populated, following T55's exact methodology ===")
    # Was entirely absent as a root key in btnyc.json until T67 (not just
    # empty -- genuinely never populated), despite the schema's own
    # description framing it as real compiler output. Verified via T55's
    # exact process before populating: a fresh compile, checked for
    # field-name mismatches against real, live data (the exact failure
    # mode that made routing_archetypes severe), and confirmed nothing
    # hand-curated existed here to lose (a different, lower-risk situation
    # than routing_archetypes, which WAS populated and at real risk).
    live_pa = live.get("pricing_archetypes")
    check("pricing_archetypes now genuinely exists in live data (was entirely absent before T67)", live_pa is not None)
    if live_pa:
        live_pa_no_note = {k: v for k, v in live_pa.items() if k != "_note"}
        fresh_pa_comparable = pa
        check("live pricing_archetypes is exactly value-equivalent to a fresh compile (the compiler is safely "
              "re-runnable for this namespace too, not just routing_archetypes)",
              live_pa_no_note == fresh_pa_comparable)

    print("\n=== T67: comprehensive, independently-reimplemented cross-check -- every real entity, not sampled ===")
    # Deliberately re-implements the classification rules separately here
    # rather than reuse compile_pricing_index/build_pricing_archetypes --
    # a test that calls the same code it's checking can't catch a bug in
    # that code's own logic, only in whether it ran without crashing.
    def independent_classify(entity, formulas):
        fe = entity.get("financial_engine", {})
        own = fe.get("pricing_archetype")
        if own:
            return own
        engine_key = entity.get("pricing_engine") or fe.get("formula_ref")
        real_formula = formulas.get(engine_key) if engine_key else None
        if fe.get("checkout_state") == "diagnostic":
            return "diagnostic_open"
        elif real_formula is not None:
            return "tiered_per_unit" if "flat_tier_price" in real_formula else "formula"
        elif (fe.get("type") or fe.get("pricing_type")) == "flat_rate":
            return "flat_simple"
        elif fe.get("type") or fe.get("pricing_type"):
            return "hourly_timed"
        return None

    formulas_live = live.get("pricing_formulas", {})
    compiler_assignment = {}
    for name, entry in pa.items():
        for eid in entry["currently_assigned_to"]:
            compiler_assignment[eid] = name

    all_entities = [(s["id"], s) for s in live["services"]] + list(live["dynamic_services"].items())
    mismatches = [
        (eid, independent_classify(e, formulas_live), compiler_assignment.get(eid))
        for eid, e in all_entities
        if independent_classify(e, formulas_live) != compiler_assignment.get(eid)
    ]
    check(f"independently-reimplemented classification agrees with the compiler for all {len(all_entities)} real "
          f"entities (100% coverage, not sampled) -- found {len(mismatches)} mismatch(es)",
          len(mismatches) == 0)

    print("\n=== Real, additive promise still holds after this restructuring ===")
    check("zero real, changed original keys", len(compiled["_additive_diff"]["CHANGED (should never happen)"]) == 0)

print(f"\n[btnyc_v8_compiler.py verification] {pass_count} passed, {fail_count} failed (of {pass_count + fail_count} checks)\n")
sys.exit(1 if fail_count > 0 else 0)
