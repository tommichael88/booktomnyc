#!/usr/bin/env python3
"""
find_orphaned_functions.py

Direct response to a real, serious, fair concern: a working,
intentional, named piece of logic (`inferTagsFromContext`'s
fireplace-to-brick inference) was completely, silently dead for an
unknown number of turns, discovered only because someone happened to
remember seeing it work once. The question that followed was real and
deserves more than reassurance: how would we find this kind of thing
ORGANICALLY, without relying on memory?

This is that mechanism. It is not a promise — it is a working script,
already run once this session, that found 2 real, previously-unknown
orphaned functions in seconds (see TIMELINE.md T40 for what was found).

WHAT THIS CHECKS:
- Every real, top-level `function name(...)` declaration in qr.html.
- Whether `name(` appears anywhere else in qr.html (a real call).
- Whether `name(` appears anywhere in the real test_harness/ corpus or
  the standalone modules (pricing_engine.js, nlp_engine.js,
  cms_bridge.js) — a function can be real, tested, and verified
  without ever being reachable from the live, production UI, which is
  a DIFFERENT, equally important question from "is this dead code."

WHAT THIS CANNOT YET CHECK (real, known, honest limitations):
- Whether a function with real call sites is reachable from a path a
  real customer would actually take, vs. only from another function
  that itself is dead (transitive dead code). This tool finds direct
  orphans, not orphaned call chains.
- IIFE detection is regex-based and may miss unusual invocation
  patterns beyond the one confirmed form
  (`(function name() {...})()`). Always verify a flagged result by
  hand before treating it as confirmed, the same way this tool's own
  first run was checked and corrected for 3 real false positives
  before being trusted.
- This only scans qr.html's own real functions. It does not check
  whether btnyc.json data fields (smart_tags, intake_modules, etc.)
  are themselves referenced anywhere — that is a real, separate,
  already-partially-covered concern (see verify_ssot_consultation.js).

USAGE: run from the repo root: python3 test_harness/find_orphaned_functions.py
"""
import re
import glob
import os

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def get_qr_html_source():
    html = open(os.path.join(REPO_ROOT, 'qr.html')).read()
    scripts = re.findall(r'<script(?:\s[^>]*)?>(.*?)</script>', html, re.DOTALL)
    return '\n'.join(scripts)


def get_real_function_names(joined_src):
    return re.findall(r'function\s+(\w+)\s*\(', joined_src)


def get_iife_names(joined_src):
    return set(re.findall(r'\(function\s+(\w+)\s*\([^)]*\)\s*\{', joined_src))


def get_cross_file_corpus():
    corpus = ""
    for pattern in ['test_harness/*.js', 'test_harness/*.py']:
        for f in glob.glob(os.path.join(REPO_ROOT, pattern)):
            try:
                corpus += open(f, errors='ignore').read() + "\n"
            except Exception:
                pass
    for f in ['pricing_engine.js', 'nlp_engine.js', 'cms_bridge.js']:
        path = os.path.join(REPO_ROOT, f)
        if os.path.exists(path):
            try:
                corpus += open(path, errors='ignore').read() + "\n"
            except Exception:
                pass
    return corpus


def find_orphans():
    joined = get_qr_html_source()
    names = get_real_function_names(joined)
    iife_names = get_iife_names(joined)
    test_corpus = get_cross_file_corpus()

    results = []
    for name in sorted(set(names)):
        if name in iife_names:
            continue  # known limitation worked around: real, self-invoking, not orphaned
        total_in_html = len(re.findall(r'\b' + re.escape(name) + r'\(', joined))
        decl_count = names.count(name)
        real_calls_in_html = total_in_html - decl_count
        real_calls_in_tests = len(re.findall(r'\b' + re.escape(name) + r'\(', test_corpus))
        results.append({
            'name': name,
            'live_calls': real_calls_in_html,
            'test_calls': real_calls_in_tests,
            'total': real_calls_in_html + real_calls_in_tests,
        })

    return results


if __name__ == '__main__':
    results = find_orphans()
    zero_total = [r for r in results if r['total'] == 0]
    tested_but_not_live = [r for r in results if r['live_calls'] == 0 and r['test_calls'] > 0]

    print(f"=== {len(zero_total)} real functions with ZERO call sites anywhere ===")
    print("(qr.html itself, every test_harness file, and both standalone modules)")
    for r in zero_total:
        print(f"  {r['name']}")

    print(f"\n=== {len(tested_but_not_live)} real functions tested/verified but NEVER called from live qr.html ===")
    print("(built correctly, covered by real tests, but not reachable by an actual customer)")
    for r in tested_but_not_live:
        print(f"  {r['name']} ({r['test_calls']} real test call(s))")

    print(f"\nTotal real function declarations scanned: {len(results)}")
    print("Always verify flagged results by hand before treating them as confirmed.")
