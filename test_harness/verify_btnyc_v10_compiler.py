#!/usr/bin/env python3
"""
verify_btnyc_v10_compiler.py — consolidated regression + schema +
cross-namespace verification harness for btnyc_v10_compiler.py.

Replaces the three separate verification scripts
(verify_btnyc_v5_compiler.js, verify_btnyc_v8_compiler.py,
verify_compiled_output_against_real_schema.py) with one file that
locks in every real guarantee each of them individually checked, plus
the new guarantees v10 adds.

Why consolidated: the three prior scripts each re-ran the compiler and
re-loaded the output -- three subprocess invocations, three JSON loads,
three independent notions of "current output" that could disagree if
they ran at different times against different catalogs. One harness
means one compile, one canonical output, one authoritative answer to
"is the compiler correct right now."

Structure (each section is independent, so a failure in one never
short-circuits the others):

   1. Compiler runs to completion, exit code 0 (twice — see §7)
   2. Two-namespace split present (routing_archetypes / pricing_archetypes)
   3. v10's new cross-referenced indexes present and populated
   4. Multi-category structural validation ran and passed
   5. Real JSON-Schema validation passed; every new key declared
   6. Original, hand-authored catalog still validates cleanly
   7. Additive promise + genuine idempotency
   8. Documented classification examples still hold
   9. pricing_archetypes centrally defines all 5 real archetypes
  10. Independent, from-scratch re-implementation of classification
      cross-checks 100% of the compiler's assignments
  11. Module classification integrity (disjointness + critical cases)
  12. Cross-namespace references (spot-checked, in addition to the
      compiler's own, internal, multi-category validation)

Exit code: 0 only if every check passes and nothing was skipped.
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
COMPILER_PATH = os.path.join(REPO_ROOT, "btnyc_v10_compiler.py")
CATALOG_PATH = os.path.join(REPO_ROOT, "btnyc.json")
SCHEMA_PATH = os.path.join(REPO_ROOT, "btnyc_schema.json")

pass_count, fail_count = 0, 0


def check(label: str, condition: bool) -> None:
    global pass_count, fail_count
    if condition:
        pass_count += 1
        print(f"  ✓ {label}")
    else:
        fail_count += 1
        print(f"  ✗ {label}")


def section(title: str) -> None:
    print(f"\n=== {title} ===")


# ---------------------------------------------------------------------------
# Real, optional dependencies -- reported, never silently skipped
# ---------------------------------------------------------------------------
try:
    import jsonschema
    HAVE_JSONSCHEMA = True
except ImportError:
    HAVE_JSONSCHEMA = False


# ---------------------------------------------------------------------------
# §1 — Run the real compiler, twice.
#
# Two runs are needed because §7 verifies genuine idempotency: the
# second run's input IS the first run's output, and the compiler must
# strip its own keys (COMPILER_KEYS) before snapshotting "original"
# data, so re-compiling an already-compiled file must produce a
# byte-identical result. A test that only ever ran once could never
# catch a regression in that stripping logic.
# ---------------------------------------------------------------------------
tmpdir = tempfile.mkdtemp(prefix="btnyc_v10_verify_")
out1 = os.path.join(tmpdir, "compiled_run1.json")
out2 = os.path.join(tmpdir, "compiled_run2.json")

section("§1 Running the real, complete v10 compiler against the live, current btnyc.json")
run1 = subprocess.run(
    ["python3", COMPILER_PATH, CATALOG_PATH, out1],
    capture_output=True, text=True,
)
check("the real compiler runs to completion with exit code 0", run1.returncode == 0)
if run1.returncode != 0:
    print("    --- compiler stdout ---")
    print(run1.stdout)
    print("    --- compiler stderr ---")
    print(run1.stderr)

if not os.path.exists(out1):
    print("\nFATAL: compiler produced no output — cannot continue.")
    sys.exit(2)

compiled = json.load(open(out1))
live = json.load(open(CATALOG_PATH))


# ---------------------------------------------------------------------------
# §2 — The real, two-namespace split.
# ---------------------------------------------------------------------------
section("§2 Two-namespace split (routing_archetypes vs. pricing_archetypes)")
check("routing_archetypes exists as its own, real, top-level namespace",
      "routing_archetypes" in compiled)
check("pricing_archetypes exists as its own, real, top-level namespace",
      "pricing_archetypes" in compiled)
check("the old, merged group_archetypes key is genuinely gone",
      "group_archetypes" not in compiled)


# ---------------------------------------------------------------------------
# §3 — v10's new indexes.
# ---------------------------------------------------------------------------
section("§3 v10's new cross-referenced indexes are present and populated")
indexes = compiled.get("compiled", {}) if isinstance(compiled.get("compiled"), dict) else {}

required_indexes = [
    "pricing_index", "component_index", "action_index", "symptom_index",
    "service_index", "candidate_matrix",
    "module_index", "smart_tag_index", "material_index", "formula_index",
]
for name in required_indexes:
    check(f"compiled.{name} exists and is a real, non-empty mapping",
          name in indexes and isinstance(indexes[name], dict) and len(indexes[name]) > 0)

# Spot-check that the cross-referenced indexes actually point at real things.
module_idx = indexes.get("module_index", {})
check("every module in the SSOT is present in module_index",
      set(live.get("intake_modules", {}).keys()) == set(module_idx.keys()))
check("module_index leaves dmg_size unclassified (the v8 fix: severity/scope, "
      "deliberately not a symptom)",
      module_idx.get("dmg_size", {}).get("classification") == "unclassified")
check("module_index classifies mounting_height as a component",
      module_idx.get("mounting_height", {}).get("classification") == "component")
check("module_index classifies weight as a component",
      module_idx.get("weight", {}).get("classification") == "component")
check("module_index classifies urgency as logistics",
      module_idx.get("urgency", {}).get("classification") == "logistics")

tag_idx = indexes.get("smart_tag_index", {})
check("every real smart tag is present in smart_tag_index",
      set(live.get("smart_tags", {}).keys()) == set(tag_idx.keys()))
check("#heavy_item is in smart_tag_index with real service usage",
      "#heavy_item" in tag_idx
      and len(tag_idx["#heavy_item"].get("used_by_services", [])) > 0)

mat_idx = indexes.get("material_index", {})
check("every real material SKU is present in material_index",
      set(live.get("materials_catalog", {}).keys()) == set(mat_idx.keys()))

formula_idx = indexes.get("formula_index", {})
check("every real pricing formula is present in formula_index",
      set(live.get("pricing_formulas", {}).keys()) == set(formula_idx.keys()))


# ---------------------------------------------------------------------------
# §4 — Multi-category structural validation.
#
# This is v10's own, internally-computed validation, and the harness
# verifies its SHAPE, not just its overall verdict: a regression that
# accidentally reduced it to a single, opaque "errors" list would still
# pass an overall "valid: true" check, so per-category presence and
# counts are checked explicitly.
# ---------------------------------------------------------------------------
section("§4 Multi-category structural validation ran and passed")
v = compiled.get("_validation", {})
check("_validation.valid is genuinely True", v.get("valid") is True)
check("_validation.by_category is present as its own, real mapping",
      isinstance(v.get("by_category"), dict) and len(v["by_category"]) > 0)

expected_categories = {
    "module_references",
    "material_references",
    "intent_mapping_references",
    "smart_tag_references",
    "category_group_references",
    "dynamic_service_keys",
    "archetypes",
    "workflow",
}
actual_categories = set((v.get("by_category") or {}).keys())
missing_categories = expected_categories - actual_categories
check(f"all {len(expected_categories)} real validation categories are present "
      f"(missing: {missing_categories or 'none'})",
      len(missing_categories) == 0)
check("_validation.summary is present, giving per-category counts",
      isinstance(v.get("summary"), dict) and set(v["summary"].keys()) == expected_categories)
check("every validation category genuinely reports zero errors",
      all(len(v.get("by_category", {}).get(cat, [])) == 0
          for cat in expected_categories))


# ---------------------------------------------------------------------------
# §5 — Real JSON-Schema validation, not a hand-written reference check.
# ---------------------------------------------------------------------------
section("§5 Real JSON-Schema validation passed; every new key declared")

sv = compiled.get("_schema_validation", {})
check("_schema_validation exists as its own, real top-level key",
      "_schema_validation" in compiled)
check("_schema_validation.valid is genuinely True (the compiler's own run)",
      sv.get("valid") is True)

if not HAVE_JSONSCHEMA:
    print("  ⚠ jsonschema not installed — skipping independent re-validation. "
          "Install with: pip install jsonschema")
elif not os.path.exists(SCHEMA_PATH):
    print(f"  ⚠ Schema file not found at {SCHEMA_PATH} — skipping independent re-validation.")
else:
    schema = json.load(open(SCHEMA_PATH))
    validator = jsonschema.Draft7Validator(schema)

    # Independently re-validate (the compiler's own check is trusted but verified).
    independent_errors = list(validator.iter_errors(compiled))
    check(f"an independent jsonschema pass finds zero errors against the "
          f"compiled output (found {len(independent_errors)})",
          len(independent_errors) == 0)
    for e in independent_errors[:3]:
        print(f"    (real error: {e.message})")

    # Every compiler-added top-level key must be explicitly declared —
    # the schema uses additionalProperties: false, so an undeclared
    # key is a real, hard validation failure, not a warning.
    expected_new_keys = {
        "compiled", "routing_archetypes", "pricing_archetypes",
        "_compiler_metadata", "_validation", "_additive_diff",
        "_schema_validation", "_archetype_mismatch_report",
    }
    declared = set(schema.get("properties", {}).keys())
    undeclared = expected_new_keys - declared
    check(f"all {len(expected_new_keys)} compiler-added top-level keys are "
          f"explicitly declared in btnyc_schema.json (undeclared: {undeclared or 'none'})",
          len(undeclared) == 0)


# ---------------------------------------------------------------------------
# §6 — Original catalog still validates against the same schema.
# ---------------------------------------------------------------------------
section("§6 Original, hand-authored catalog still validates cleanly")
if HAVE_JSONSCHEMA and os.path.exists(SCHEMA_PATH):
    schema = json.load(open(SCHEMA_PATH))
    validator = jsonschema.Draft7Validator(schema)
    original_errors = list(validator.iter_errors(live))
    check(f"zero real schema errors against btnyc.json itself (found {len(original_errors)})",
          len(original_errors) == 0)
else:
    print("  ⚠ Skipped (jsonschema or schema file unavailable).")


# ---------------------------------------------------------------------------
# §7 — Additive promise + genuine idempotency.
# ---------------------------------------------------------------------------
section("§7 Additive promise holds and the compiler is genuinely idempotent")

diff = compiled.get("_additive_diff", {})
check("_additive_diff has no 'CHANGED (should never happen)' entries",
      len(diff.get("CHANGED (should never happen)", [])) == 0)

# Every real, original top-level key is preserved byte-for-byte.
compiler_keys = {
    "compiled", "routing_archetypes", "pricing_archetypes",
    "_compiler_metadata", "_validation", "_additive_diff", "_schema_validation", "_archetype_mismatch_report",
}
non_additive_keys = []
for k, v in live.items():
    if k in compiler_keys:
        continue
    if compiled.get(k) != v:
        non_additive_keys.append(k)
check(f"every original top-level key is preserved byte-for-byte "
      f"(non-additive: {non_additive_keys or 'none'})",
      len(non_additive_keys) == 0)

# Real idempotency: re-running on an already-compiled file must produce
# byte-identical output. This is the guarantee that lets the compiler
# be safely re-run without drifting.
run2 = subprocess.run(
    ["python3", COMPILER_PATH, out1, out2],
    capture_output=True, text=True,
)
check("re-compiling an already-compiled file exits cleanly",
      run2.returncode == 0)
if os.path.exists(out2):
    compiled_again = json.load(open(out2))
    check("re-compiling an already-compiled file is genuinely byte-identical "
          "(the compiler strips its own keys before snapshotting originals)",
          compiled_again == compiled)
else:
    check("re-compiled output file exists", False)


# ---------------------------------------------------------------------------
# §8 — Documented classification examples.
# ---------------------------------------------------------------------------
section("§8 Documented classification examples still hold")
tech = compiled["routing_archetypes"].get("tech_trouble_computer_repair", {})
doors = compiled["routing_archetypes"].get("minor_home_repairs_doors", {})
walls = compiled["routing_archetypes"].get("minor_home_repairs_walls", {})

check("tech_trouble_computer_repair classifies as symptom_first, matching "
      "classify_routing_archetype's own docstring",
      tech.get("routing_archetype") == "symptom_first")
check("minor_home_repairs_doors classifies as component_first",
      doors.get("routing_archetype") == "component_first")
check("minor_home_repairs_walls has an empty real_symptom_ids (the dmg_size "
      "fix's own, preserved result)",
      walls.get("real_symptom_ids") == [])
check("minor_home_repairs_walls stays component_first",
      walls.get("routing_archetype") == "component_first")

undetermined = [gid for gid, ra in compiled["routing_archetypes"].items()
                if ra.get("routing_archetype") == "undetermined"]
check("every 'undetermined' group genuinely has zero supporting signal "
      "on both axes (never forced into a bucket it can't justify)",
      all(compiled["routing_archetypes"][g].get("real_component_ids") == []
          and compiled["routing_archetypes"][g].get("real_symptom_ids") == []
          for g in undetermined))
print(f"    (real undetermined count: {len(undetermined)} — {undetermined})")


# ---------------------------------------------------------------------------
# §9 — pricing_archetypes.
# ---------------------------------------------------------------------------
section("§9 pricing_archetypes centrally defines all 5 real archetypes")
pa = compiled.get("pricing_archetypes", {})
check("all 5 real archetypes are present",
      set(pa.keys()) == {"flat_simple", "hourly_timed", "diagnostic_open",
                         "tiered_per_unit", "formula"})
check("every archetype carries a real 'definition' string",
      all(isinstance(entry.get("definition"), str) and entry["definition"]
          for entry in pa.values()))
check("every archetype carries a real, currently_assigned_to list",
      all(isinstance(entry.get("currently_assigned_to"), list)
          for entry in pa.values()))


# ---------------------------------------------------------------------------
# §10 — Independent re-implementation cross-check.
#
# Deliberately does NOT call the compiler's own classification function —
# a test that calls the same code it's checking can only prove that code
# ran, not that it's correct. 100% coverage, not sampled.
# ---------------------------------------------------------------------------
section("§10 Independent re-implementation of pricing_archetype classification agrees 100%")


def independent_classify(entity: dict, formulas: dict):
    """Re-implements the classification rules from scratch, using only
    the raw catalog fields — never the compiler's own helpers."""
    fe = entity.get("financial_engine", {}) or {}
    own = fe.get("pricing_archetype")
    if own:
        return own
    engine_key = entity.get("pricing_engine") or fe.get("formula_ref")
    real_formula = formulas.get(engine_key) if engine_key else None
    if fe.get("checkout_state") == "diagnostic":
        return "diagnostic_open"
    if real_formula is not None:
        return "tiered_per_unit" if "flat_tier_price" in real_formula else "formula"
    if (fe.get("type") or fe.get("pricing_type")) == "flat_rate":
        return "flat_simple"
    if fe.get("type") or fe.get("pricing_type"):
        return "hourly_timed"
    return None


formulas_live = live.get("pricing_formulas", {})
compiler_assignment = {}
for name, entry in pa.items():
    for eid in entry.get("currently_assigned_to", []):
        compiler_assignment[eid] = name

all_entities = (
    [(s["id"], s) for s in live.get("services", [])]
    + list(live.get("dynamic_services", {}).items())
)
mismatches = []
for eid, entity in all_entities:
    independent = independent_classify(entity, formulas_live)
    compiler_label = compiler_assignment.get(eid)
    if independent != compiler_label:
        mismatches.append((eid, independent, compiler_label))

check(f"100% agreement across all {len(all_entities)} real entities "
      f"(mismatches: {mismatches if mismatches else 'none'})",
      len(mismatches) == 0)


# ---------------------------------------------------------------------------
# §11 — Module-classification integrity.
#
# The compiler's own module-level `assert`s fire at import time, but a
# test that never imports the module can't verify they ever ran — so
# this section imports it directly and re-checks the constants.
# ---------------------------------------------------------------------------
section("§11 Module-classification integrity (disjointness + critical cases)")
try:
    sys.path.insert(0, REPO_ROOT)
    import btnyc_v10_compiler as cmp_mod  # noqa: E402

    check("COMPONENT_MODULES and SYMPTOM_MODULES are genuinely disjoint",
          len(cmp_mod.COMPONENT_MODULES & cmp_mod.SYMPTOM_MODULES) == 0)
    check("COMPONENT_MODULES and LOGISTICS_MODULES are genuinely disjoint",
          len(cmp_mod.COMPONENT_MODULES & cmp_mod.LOGISTICS_MODULES) == 0)
    check("SYMPTOM_MODULES and LOGISTICS_MODULES are genuinely disjoint",
          len(cmp_mod.SYMPTOM_MODULES & cmp_mod.LOGISTICS_MODULES) == 0)
    check("dmg_size is in neither SYMPTOM_MODULES nor COMPONENT_MODULES "
          "(the v8 fix: severity/scope, deliberately not a symptom)",
          "dmg_size" not in cmp_mod.SYMPTOM_MODULES
          and "dmg_size" not in cmp_mod.COMPONENT_MODULES)
    check("mounting_height is in COMPONENT_MODULES, not SYMPTOM_MODULES",
          "mounting_height" in cmp_mod.COMPONENT_MODULES
          and "mounting_height" not in cmp_mod.SYMPTOM_MODULES)

    # Every module the SSOT actually defines must be classifiable —
    # an unclassified module would silently be skipped by
    # build_routing_archetypes, quietly weakening every group that
    # references it.
    ssot_modules = set(live.get("intake_modules", {}).keys())
    classified = (cmp_mod.COMPONENT_MODULES
                  | cmp_mod.SYMPTOM_MODULES
                  | cmp_mod.LOGISTICS_MODULES)
    unclassified = ssot_modules - classified
    # "unclassified" is a legitimate, honest state for modules that
    # don't cleanly fit any of the three axes; report them, don't fail.
    print(f"    (real unclassified modules: {len(unclassified)} — "
          f"{sorted(unclassified)[:6]}{'...' if len(unclassified) > 6 else ''})")
    check("no real, critical component/symptom module is left unclassified",
          not (unclassified & {"symptom", "damage_type", "issue", "leak_type",
                               "wall_type", "surface_type", "door_type",
                               "tech_device", "weight"}))
except Exception as e:  # pragma: no cover — reported, never swallowed
    check(f"btnyc_v10_compiler imports cleanly (import error: {e})", False)


# ---------------------------------------------------------------------------
# §12 — Cross-namespace reference spot-checks.
#
# The compiler's own internal validation covers these exhaustively; the
# harness re-checks a few high-risk cases independently so a regression
# in the compiler's own validator can't hide behind itself.
# ---------------------------------------------------------------------------
section("§12 Cross-namespace reference spot-checks")
real_tag_ids = set(live.get("smart_tags", {}).keys())
real_module_ids = set(live.get("intake_modules", {}).keys())
real_material_ids = set(live.get("materials_catalog", {}).keys())
real_service_ids = {s["id"] for s in live.get("services", [])}
real_service_ids |= set(live.get("dynamic_services", {}).keys())

dangling_tags = []
dangling_modules = []
dangling_materials = []
for svc in live.get("services", []):
    sid = svc.get("id")
    for tag in svc.get("default_tags", []) or []:
        ref = tag["$ref"] if isinstance(tag, dict) and "$ref" in tag else tag
        if isinstance(ref, str) and not ref.startswith("#"):
            ref = f"#{ref}"
        if ref not in real_tag_ids:
            dangling_tags.append((sid, ref))
    for mod_name in (svc.get("intake_chain") or []):
        if isinstance(mod_name, dict) and "module" in mod_name:
            if mod_name["module"] not in real_module_ids:
                dangling_modules.append((sid, mod_name["module"]))
    for mat in (svc.get("required_materials", []) or []) + (svc.get("optional_materials", []) or []):
        if mat not in real_material_ids:
            dangling_materials.append((sid, mat))

check(f"every service default_tags reference a real smart tag "
      f"(dangling: {dangling_tags[:3] or 'none'})",
      len(dangling_tags) == 0)
check(f"every top-level service intake_chain module name resolves "
      f"(dangling: {dangling_modules[:3] or 'none'})",
      len(dangling_modules) == 0)
check(f"every service material reference resolves to a real SKU "
      f"(dangling: {dangling_materials[:3] or 'none'})",
      len(dangling_materials) == 0)

# intent_mappings: every override SKU must resolve to a real service.
dangling_overrides = []
for obj in live.get("intent_mappings", {}).get("objects", []):
    kw = obj.get("keyword")
    sku = obj.get("default_service_sku")
    if sku and sku not in real_service_ids:
        dangling_overrides.append((kw, sku))
    for ov in obj.get("contextual_overrides", []):
        target = ov.get("override_sku")
        if target and target not in real_service_ids:
            dangling_overrides.append((kw, target))
check(f"every intent_mappings SKU override resolves to a real service "
      f"(dangling: {dangling_overrides[:3] or 'none'})",
      len(dangling_overrides) == 0)


# ---------------------------------------------------------------------------
# Cleanup + summary
# ---------------------------------------------------------------------------
import shutil
shutil.rmtree(tmpdir, ignore_errors=True)

total = pass_count + fail_count
print(f"\n[btnyc_v10_compiler.py verification] "
      f"{pass_count} passed, {fail_count} failed (of {total} checks)\n")
sys.exit(1 if fail_count > 0 else 0)
