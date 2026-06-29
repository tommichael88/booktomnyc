#!/usr/bin/env python3
"""
verify_compiled_output_against_real_schema.py

Direct response to a real, severe, confirmed gap found via external
review: every prior compiler version (v5 through v8)'s own
validate_references() function only checked that intake-module/
material references point to things that exist -- it NEVER actually
ran the compiled output through a real JSON Schema validator. Each
version's code comments claimed to have "confirmed against the live
schema," but that only ever meant reading field names by eye, not
running jsonschema.Draft7Validator against the real, compiled result.

CONFIRMED VIA DIRECT, EXTERNAL VALIDATION: btnyc_schema.json has
"additionalProperties": false at its real, top level (and in several
nested places) -- a deliberate, consistent, strict design choice
throughout the schema, not an accident. Running v8's actual compiled
output through jsonschema.Draft7Validator found exactly 1 real error:
every one of the compiler's new, additive top-level keys
(compiled/routing_archetypes/pricing_archetypes/_compiler_metadata/
_validation/_additive_diff) was undeclared and therefore rejected.

This was true of every prior version too -- confirmed by running v5's
and v7's real output against the (now-updated) schema: 1 real error
each, for the same real reason (their old key names, e.g.
group_archetypes, were also never declared).

FIXED by adding explicit, top-level property declarations for the 6
new keys to btnyc_schema.json -- deliberately permissive (type: object,
no nested schema) since their internal shape is the compiler's own,
evolving, separately-tested responsibility (see
verify_btnyc_v8_compiler.py), not something that should need editing
every time the compiler legitimately changes shape.

THIS TEST exists so this exact gap can never silently recur: it
actually runs jsonschema against real, current compiler output, not a
hand-written reference check that only covers what its author thought
to check.
"""
import json
import subprocess
import sys
import tempfile
import os

try:
    import jsonschema
except ImportError:
    print("FATAL: the 'jsonschema' package is required for this real test. Install with: pip install jsonschema --break-system-packages")
    sys.exit(2)

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


schema = json.load(open(os.path.join(REPO_ROOT, "btnyc_schema.json")))
validator = jsonschema.Draft7Validator(schema)

print("=== The real, original, hand-authored catalog still validates cleanly ===")
original = json.load(open(os.path.join(REPO_ROOT, "btnyc.json")))
original_errors = list(validator.iter_errors(original))
check(f"zero real schema errors against btnyc.json itself (found {len(original_errors)})", len(original_errors) == 0)

print("\n=== The real, current compiler's actual, live output genuinely validates against the real schema ===")
with tempfile.TemporaryDirectory() as tmpdir:
    output_path = os.path.join(tmpdir, "compiled.json")
    result = subprocess.run(
        ["python3", os.path.join(REPO_ROOT, "btnyc_v8_compiler.py"),
         os.path.join(REPO_ROOT, "btnyc.json"), output_path],
        capture_output=True, text=True,
    )
    check("the real compiler runs to completion", result.returncode == 0)

    compiled = json.load(open(output_path))
    compiled_errors = list(validator.iter_errors(compiled))
    check(f"zero real schema errors against the actual, compiled v8 output (found {len(compiled_errors)})", len(compiled_errors) == 0)
    for e in compiled_errors:
        print(f"    (real error: {e.message})")

print("\n=== Every real, new top-level key the compiler adds is explicitly declared in the schema ===")
expected_new_keys = {"compiled", "routing_archetypes", "pricing_archetypes", "_compiler_metadata", "_validation", "_additive_diff"}
declared = set(schema.get("properties", {}).keys())
missing_declarations = expected_new_keys - declared
check(f"all {len(expected_new_keys)} real, new keys are explicitly declared in the schema (missing: {missing_declarations or 'none'})", len(missing_declarations) == 0)

print(f"\n[compiled output vs. real schema verification] {pass_count} passed, {fail_count} failed (of {pass_count + fail_count} checks)\n")
sys.exit(1 if fail_count > 0 else 0)
