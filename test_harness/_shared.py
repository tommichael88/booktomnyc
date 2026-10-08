#!/usr/bin/env python3
"""
_shared.py

Standardized test-framework internals for Python verifiers in this
harness. Identical interface to _shared.js -- same function names, same
output format, same state-file shape -- so a decision or a failure
looks the same regardless of which language caught it.

Usage in a verifier:
    from _shared import check, finish
    check("some real assertion", condition, decision="D-dmg_size-not-symptom")
    ...
    finish()
"""
import hashlib
import json
import os
import re
import sys
from datetime import datetime, timezone

TEST_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.dirname(TEST_DIR)
RESULTS_DIR = os.path.join(TEST_DIR, "RESULTS")
DECISIONS_PATH = os.path.join(TEST_DIR, "decisions.json")
FAILURES_PATH = os.path.join(RESULTS_DIR, "failures.jsonl")

os.makedirs(RESULTS_DIR, exist_ok=True)

_decisions_cache = None


def _load_decisions():
    global _decisions_cache
    if _decisions_cache is not None:
        return _decisions_cache
    try:
        with open(DECISIONS_PATH, encoding="utf-8") as f:
            _decisions_cache = json.load(f)
    except Exception:
        _decisions_cache = {}
    return _decisions_cache


def get_qr_build_version():
    try:
        with open(os.path.join(REPO_ROOT, "qr.html"), encoding="utf-8") as f:
            qr = f.read()
        m = re.search(r"QR_BUILD_VERSION\s*=\s*'([^']+)'", qr)
        return m.group(1) if m else "unknown"
    except Exception:
        return "unknown"


_state = {
    "test_file": os.path.basename(sys.argv[0] or "unknown"),
    "pass": 0,
    "fail": 0,
    "checks": [],
}


def _print_decision_context(decision_id):
    decisions = _load_decisions()
    d = decisions.get(decision_id)
    if not d:
        print(f"    \u26a0 decision '{decision_id}' referenced but not found in decisions.json")
        return
    print(f"    \u2192 [{decision_id}] {d.get('invariant', '(no invariant recorded)')}")
    if d.get("why_dangerous"):
        print(f"      Why this matters: {d['why_dangerous']}")
    if d.get("charter_refs"):
        print(f"      Charter: {', '.join(d['charter_refs'])}")
    if d.get("timeline_refs"):
        print(f"      Timeline: {', '.join(d['timeline_refs'])}")
    if d.get("confidence"):
        print(f"      Registry confidence: {d['confidence']}")


def _append_failure_record(label, decision, expected, got):
    record = {
        "at": datetime.now(timezone.utc).isoformat(),
        "test_file": _state["test_file"],
        "label": label,
        "decision": decision,
        "expected": expected,
        "got": got,
    }
    try:
        with open(FAILURES_PATH, "a", encoding="utf-8") as f:
            f.write(json.dumps(record) + "\n")
    except Exception:
        pass  # non-fatal -- don't let RESULTS/ write issues mask the real failure


def check(label, condition, decision=None, expected=None, got=None):
    """
    label: str describing the assertion
    condition: bool
    decision: optional D-xxx id from decisions.json. On failure, prints
      the human-readable context (invariant, why_dangerous, refs) and
      appends a minimal record to RESULTS/failures.jsonl for an AI
      investigator to look up by id.
    """
    ok = bool(condition)
    if ok:
        _state["pass"] += 1
        print(f"  \u2713 {label}")
    else:
        _state["fail"] += 1
        print(f"  \u2717 {label}")
        if decision:
            _print_decision_context(decision)
        _append_failure_record(label, decision, expected, got)
    _state["checks"].append({"label": label, "passed": ok, "decision": decision})
    return ok


def finish(suite_name=None):
    """Prints the standard summary line and exits 0/1, matching every
    existing verifier's own convention."""
    name = suite_name or _state["test_file"]
    total = _state["pass"] + _state["fail"]
    print(f"\n[{name}] {_state['pass']} passed, {_state['fail']} failed (of {total} checks)\n")
    sys.exit(1 if _state["fail"] > 0 else 0)


def envelope(tool, summary, findings):
    """Standard shape for generated RESULTS/*.json output:
    {tool, generated_at, qr_build_version, summary, findings}"""
    return {
        "tool": tool,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "qr_build_version": get_qr_build_version(),
        "summary": summary,
        "findings": findings,
    }


def sha256_short(file_path):
    try:
        with open(file_path, "rb") as f:
            content = f.read()
        return hashlib.sha256(content).hexdigest()[:16]
    except Exception:
        return None
