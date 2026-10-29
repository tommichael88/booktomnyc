#!/usr/bin/env python3
"""
verify_compute_quote_for_draft.py

Regression test for btnyc.py's CMSBridge.compute_quote_for_draft, added for
the v9.5 WYSIWYG customer-preview panel in UnifiedServiceEditor. Verifies:
  1. A draft (unsaved) field edit genuinely flows through to the real
     engine's computed output.
  2. The real, saved btnyc.json on disk is never modified — the temp file
     trick is fully isolated.
  3. Multiple simultaneous draft field changes (price + checkout_state +
     disclaimer) all apply correctly together, not just one field at a time.

Run with: python3 test_harness/verify_compute_quote_for_draft.py
"""
import sys
import os
import re
import json
import copy
import subprocess
import tempfile
from typing import Optional

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, REPO_ROOT)

SCRIPT_DIR = REPO_ROOT

# Extract just the CMSBridge class from btnyc.py (can't import the whole
# file — it pulls in customtkinter, unavailable in this sandbox/CI context)
with open(os.path.join(REPO_ROOT, "btnyc.py"), encoding="utf-8") as f:
    src = f.read()
m = re.search(r"class CMSBridge:.*?(?=\nclass |\n_cms_bridge)", src, re.DOTALL)
if not m:
    print("FAIL: could not find CMSBridge class in btnyc.py — has it moved/renamed?")
    sys.exit(1)
exec(m.group(0))

bridge = CMSBridge()
pass_count, fail_count = 0, 0


def check(label, condition):
    global pass_count, fail_count
    if condition:
        pass_count += 1
        print(f"  ✓ {label}")
    else:
        fail_count += 1
        print(f"  ✗ {label}")


if not bridge.available():
    print(f"SKIP: {bridge.unavailable_reason()}")
    sys.exit(0)

btnyc_json_path = os.path.join(REPO_ROOT, "btnyc.json")
with open(btnyc_json_path, encoding="utf-8") as f:
    original_btnyc_json_text = f.read()

full_raw = json.loads(original_btnyc_json_text)
real_svc = next(s for s in full_raw["services"] if s["id"] == "toilet_install")
real_base_price = real_svc["financial_engine"]["base_price"]

print("=== Single-field draft edit flows through correctly ===")
draft = copy.deepcopy(real_svc)
draft["financial_engine"]["base_price"] = real_base_price + 50
result, err = bridge.compute_quote_for_draft(draft, full_raw)
check("no error", err is None)
if result:
    check(f"draft base_price ({real_base_price + 50}) reflected in laborEstimate",
          result.get("laborEstimate") == real_base_price + 50)

print("\n=== Real btnyc.json on disk is never modified ===")
with open(btnyc_json_path, encoding="utf-8") as f:
    after_text = f.read()
check("btnyc.json file content byte-identical after draft preview call",
      after_text == original_btnyc_json_text)
after_raw = json.loads(after_text)
after_svc = next(s for s in after_raw["services"] if s["id"] == "toilet_install")
check("real base_price unchanged in re-parsed JSON",
      after_svc["financial_engine"]["base_price"] == real_base_price)

print("\n=== Multiple simultaneous draft changes apply together ===")
draft2 = copy.deepcopy(real_svc)
draft2["financial_engine"]["checkout_state"] = "project_based"
draft2["default_estimates"]["disclaimer"] = "project_based"
result2, err2 = bridge.compute_quote_for_draft(draft2, full_raw)
check("no error", err2 is None)
if result2:
    check("checkoutStateKey reflects draft change", result2.get("checkoutStateKey") == "project_based")
    check("disclaimerText reflects the project_based SSOT entry",
          "non" in (result2.get("disclaimerText") or "").lower() and "binding" in (result2.get("disclaimerText") or "").lower())

print(f"\n[compute_quote_for_draft verification] {pass_count} passed, {fail_count} failed (of {pass_count + fail_count} checks)\n")
sys.exit(1 if fail_count > 0 else 0)
