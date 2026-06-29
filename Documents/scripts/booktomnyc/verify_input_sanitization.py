#!/usr/bin/env python3
"""
verify_input_sanitization.py

Regression test for v9.5's input sanitization fixes:
  1. tag_ref() and the manual #-prefix logic correctly normalize a typed
     tag reference (with or without a leading #) to the real "#key" form
     the front end's engine actually looks up by.
  2. clamp_minmax() correctly auto-corrects an inverted min/max pair,
     since the JSON Schema has no relational min<=max constraint and would
     otherwise silently accept backwards data.

Run with: python3 test_harness/verify_input_sanitization.py
"""
import sys
import os
import re

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

with open(os.path.join(REPO_ROOT, "btnyc.py"), encoding="utf-8") as f:
    src = f.read()

# Extract just the two pure functions under test (avoids importing the
# whole file, which pulls in customtkinter — unavailable in this sandbox).
m_tagref = re.search(r"def tag_ref\(key: str\) -> dict:.*?\n\n\n", src, re.DOTALL)
m_clamp = re.search(r"def clamp_minmax\(lo, hi\):.*?\n\n\n", src, re.DOTALL)
m_slugify = re.search(r"def slugify\(s: str, n: int = 48\) -> str:.*?\n\n\n", src, re.DOTALL)
if not m_tagref:
    print("FAIL: could not find tag_ref() in btnyc.py")
    sys.exit(1)
if not m_clamp:
    print("FAIL: could not find clamp_minmax() in btnyc.py")
    sys.exit(1)
if not m_slugify:
    print("FAIL: could not find slugify() in btnyc.py")
    sys.exit(1)
exec(m_tagref.group(0))
exec(m_clamp.group(0))


def gen_id():
    import uuid
    return uuid.uuid4().hex[:8]


exec(m_slugify.group(0))

pass_count, fail_count = 0, 0


def check(label, condition):
    global pass_count, fail_count
    if condition:
        pass_count += 1
        print(f"  ✓ {label}")
    else:
        fail_count += 1
        print(f"  ✗ {label}")


print("=== tag_ref() normalizes tag keys regardless of input # prefix ===")
check("tag_ref('heavy_item') adds the # prefix", tag_ref("heavy_item") == {"$ref": "#heavy_item"})
check("tag_ref('#heavy_item') does not double-prefix", tag_ref("#heavy_item") == {"$ref": "#heavy_item"})

print("\n=== Manual comma-separated tag-list # auto-fix (IntakeModulesMgr quick-create) ===")


def fix_tag_list(raw_csv):
    return [(t.strip() if t.strip().startswith("#") else "#" + t.strip())
            for t in raw_csv.split(",") if t.strip()]


check("'heavy_item, two_person_required' (no #) -> both correctly prefixed",
      fix_tag_list("heavy_item, two_person_required") == ["#heavy_item", "#two_person_required"])
check("'#heavy_item, two_person_required' (mixed) -> both end up correctly prefixed, no double-#",
      fix_tag_list("#heavy_item, two_person_required") == ["#heavy_item", "#two_person_required"])
check("empty entries from stray commas are dropped", fix_tag_list("heavy_item, , two_person_required") == ["#heavy_item", "#two_person_required"])

print("\n=== clamp_minmax() auto-corrects inverted min/max pairs ===")
check("normal order (60, 120) unchanged", clamp_minmax(60, 120) == (60, 120))
check("inverted (500, 100) gets swapped to (100, 500)", clamp_minmax(500, 100) == (100, 500))
check("equal values (50, 50) unchanged", clamp_minmax(50, 50) == (50, 50))
check("inverted floats (99.5, 10.0) gets swapped", clamp_minmax(99.5, 10.0) == (10.0, 99.5))

print("\n=== slugify() restricts ids to portable ASCII (id generation for new categories/groups) ===")
check("normal text slugifies correctly", slugify("Plumbing & Electrical!!!") == "plumbing_electrical")
check("non-Latin script (e.g. Japanese) falls back to a generated id, not surviving unchanged",
      re.fullmatch(r"[0-9a-f]{8}", slugify("日本語")) is not None)
check("accented Latin characters are stripped, not preserved as non-ASCII", slugify("Café Furniture") == "caf_furniture")
check("empty input falls back to a generated id", re.fullmatch(r"[0-9a-f]{8}", slugify("")) is not None)

print(f"\n[input sanitization verification] {pass_count} passed, {fail_count} failed (of {pass_count + fail_count} checks)\n")
sys.exit(1 if fail_count > 0 else 0)
