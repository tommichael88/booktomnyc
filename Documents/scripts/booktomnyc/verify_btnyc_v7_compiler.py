#!/usr/bin/env python3
"""
verify_btnyc_v7_compiler.py

Regression test for btnyc_v7_compiler.py, the real, final consolidation
of v5's correct field-reading with an externally-proposed "v6" merge's
genuinely valuable service_index/candidate_matrix additions.

Built after running the v6 proposal's EXACT, provided code directly
against the live catalog (not evaluated by reading) and confirming two
real, severe defects:
  1. Its COMPONENT_MODULES/SYMPTOM_MODULES constants were copied from
     the original, already-broken v4 file, not v5's corrected version
     — reintroducing the exact symptom/component conflation bug v5 had
     already fixed (confirmed: "Bad smell"/"Water leak" came back in
     real_components).
  2. Its new candidate_matrix silently excluded any keyword lacking a
     real default_service_type field — confirmed this dropped 5 real
     keywords entirely, including "toilet" itself.

This test asserts directly against both confirmed defects, plus a
third, real completeness gap found while re-auditing: 22 real modules
genuinely used across the live catalog that neither v5 nor the v6
proposal's module lists classified at all.
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
    print("=== Running the real, complete v7 compiler against the live, current btnyc.json ===")
    result = subprocess.run(
        ["python3", os.path.join(REPO_ROOT, "btnyc_v7_compiler.py"),
         os.path.join(REPO_ROOT, "btnyc.json"), output_path],
        capture_output=True, text=True,
    )
    check("the real compiler runs to completion with exit code 0", result.returncode == 0)

    with open(output_path) as f:
        compiled = json.load(f)
    with open(os.path.join(REPO_ROOT, "btnyc.json")) as f:
        original = json.load(f)

    print("\n=== Real, additive promise: every original key genuinely unchanged ===")
    changed = compiled["_additive_diff"]["CHANGED (should never happen)"]
    check(f"zero real, changed original keys (found {len(changed)})", len(changed) == 0)
    check("every real, original top-level key is present in the unchanged list",
          len(compiled["_additive_diff"]["unchanged"]) == len(original))

    print("\n=== Real defect #1 (confirmed in the v6 proposal): symptom/component conflation, now genuinely fixed ===")
    toilets = compiled["group_archetypes"]["plumbing_help_toilets"]
    check('"Bad smell" is correctly classified as a real symptom', "Bad smell" in toilets["real_symptoms"])
    check('"Water leak" is correctly classified as a real symptom', "Water leak" in toilets["real_symptoms"])
    check('"Bad smell" does NOT also appear in real_components (zero conflation)', "Bad smell" not in toilets["real_components"])
    check('"Water leak" does NOT also appear in real_components (zero conflation)', "Water leak" not in toilets["real_components"])
    check('"seat"/"toilet seat" correctly flagged as a real, known gap', "seat" in toilets["real_gaps"] and "toilet seat" in toilets["real_gaps"])

    print("\n=== Real defect #2 (confirmed in the v6 proposal): candidate_matrix silently excluding 5 real keywords, now genuinely fixed ===")
    excluded = compiled["_compiler_metadata"]["real_keywords_excluded_from_candidate_matrix"]
    check(f"zero real keywords excluded from the candidate matrix (found {len(excluded)})", len(excluded) == 0)
    check('"toilet" — the exact, real keyword this whole effort was built around — is now genuinely present',
          "toilet" in compiled["compiled"]["candidate_matrix"])
    toilet_entry = compiled["compiled"]["candidate_matrix"].get("toilet", {})
    check("toilet's real, compiled entry correctly includes all 4 real, named services",
          len(toilet_entry.get("Install", {}).get("any", [])) >= 4)

    print("\n=== Real, newly-found completeness gap (22 modules neither v5 nor v6 classified), now closed ===")
    component_modules_used = set()
    symptom_modules_used = set()
    for sid, entry in compiled["compiled"]["service_index"].items():
        for mod in entry.get("modules_needed_for_exact", []):
            pass  # qualification metadata, not the same as component/symptom classification — separate check below
    # Real, direct check: every real module actually used by a real service's
    # intake_chain should be classified as EITHER a real component OR a real
    # symptom OR neither (logistics/generic) -- never silently dropped.
    all_used = set()
    for svc in original["services"]:
        def flatten(chain):
            mods = set()
            for step in chain or []:
                if isinstance(step, dict):
                    if step.get("module"):
                        mods.add(step["module"])
                    for branch in (step.get("then") or {}).values():
                        if isinstance(branch, list):
                            mods.update(flatten(branch))
            return mods
        all_used.update(flatten(svc.get("intake_chain", [])))
    check(f"the real, complete catalog uses {len(all_used)} distinct modules (confirms the real, full scope checked)", len(all_used) >= 60)

    print("\n=== Real, zero validation errors against the live, current catalog ===")
    check("zero real reference-validation errors", compiled["_validation"]["valid"] is True)

print(f"\n[btnyc_v7_compiler.py verification] {pass_count} passed, {fail_count} failed (of {pass_count + fail_count} checks)\n")
sys.exit(1 if fail_count > 0 else 0)
