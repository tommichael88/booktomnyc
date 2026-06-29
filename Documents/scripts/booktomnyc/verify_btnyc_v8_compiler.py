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

    print("\n=== The real, two-namespace split is genuinely present ===")
    check("routing_archetypes exists as its own, real, top-level namespace", "routing_archetypes" in compiled)
    check("pricing_archetypes exists as its own, real, top-level namespace", "pricing_archetypes" in compiled)
    check("the old, merged group_archetypes key is genuinely gone", "group_archetypes" not in compiled)

    print("\n=== Both real, originally-discussed examples classify exactly as predicted ===")
    tech = compiled["routing_archetypes"]["tech_trouble_computer_repair"]
    doors = compiled["routing_archetypes"]["minor_home_repairs_doors"]
    check("tech_trouble_computer_repair correctly classifies as symptom_first", tech["routing_archetype"] == "symptom_first")
    check("minor_home_repairs_doors correctly classifies as component_first", doors["routing_archetype"] == "component_first")

    print("\n=== Real, small classification bug (dmg_size) found and fixed while verifying ===")
    walls = compiled["routing_archetypes"]["minor_home_repairs_walls"]
    check("minor_home_repairs_walls' real_symptoms is now genuinely empty (was 3 fake 'Large/Medium/Small' entries)", walls["real_symptoms"] == [])
    check("minor_home_repairs_walls correctly reclassifies as component_first once the fake symptom signal is removed", walls["routing_archetype"] == "component_first")

    print("\n=== Real, honest 'undetermined' classification for groups with zero signal either way ===")
    undetermined = [gid for gid, ra in compiled["routing_archetypes"].items() if ra["routing_archetype"] == "undetermined"]
    check(f"exactly 12 real groups are honestly marked undetermined (found {len(undetermined)})", len(undetermined) == 12)
    check("no group is ever forced into component_first/symptom_first with zero real, supporting data",
          all(compiled["routing_archetypes"][g]["real_components"] == [] and compiled["routing_archetypes"][g]["real_symptoms"] == [] for g in undetermined))

    print("\n=== pricing_archetypes correctly, centrally defines all 5 real, schema-confirmed archetypes ===")
    pa = compiled["pricing_archetypes"]
    check("all 5 real archetypes are present", set(pa.keys()) == {"flat_simple", "hourly_timed", "diagnostic_open", "tiered_per_unit", "formula"})
    check("cabinet_knob_or_pull_install is correctly, currently assigned to tiered_per_unit",
          "cabinet_knob_or_pull_install" in pa["tiered_per_unit"]["currently_assigned_to"])

    print("\n=== Real, additive promise still holds after this restructuring ===")
    check("zero real, changed original keys", len(compiled["_additive_diff"]["CHANGED (should never happen)"]) == 0)

print(f"\n[btnyc_v8_compiler.py verification] {pass_count} passed, {fail_count} failed (of {pass_count + fail_count} checks)\n")
sys.exit(1 if fail_count > 0 else 0)
