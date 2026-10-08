#!/usr/bin/env python3
"""
find_duplicate_logic_candidates.py

Direct response to a real, evidenced pattern: this session found at
least 3 separate real bugs (two `extractObject` implementations,
`_resolveIntakeChain` vs. `orch_compose_intake_chain`, and
`sqAnalyze` vs. `collectBookingContext_freeText`) where one real
function duplicated another's logic instead of calling it, and every
one was found by accident or by someone else's memory — never by a
systematic sweep for the pattern itself.

This is that sweep. It is a real, mechanical heuristic, not a
guarantee: two functions that call several of the same OTHER real
functions are real candidates for "doing the same job twice," worth a
direct, manual check — not proof of duplication on their own.

CONFIRMED WORKING: this exact tool, in its first real run, found the
`sqAnalyze <-> collectBookingContext_freeText` pair with zero prior
knowledge of the bug — see TIMELINE.md T40/T41 for the full story.

HOW TO USE THE OUTPUT:
- Every pair listed is a real candidate, not a confirmed bug. Check
  each by hand: read both functions, confirm whether they are
  genuinely performing the same real-world operation (a true
  duplicate) or merely share infrastructure incidentally (a false
  positive — e.g. two unrelated renderers that both happen to call
  `addToCart`/`toast`/`renderIcon`, which says nothing about whether
  their CORE logic overlaps).
- A real, confirmed duplicate where one side is newer/cleaner/
  orchestrator-shaped is a real rewire candidate, the same pattern
  fixed multiple times this session.
- A real, confirmed duplicate where NEITHER side is clearly preferred
  is worth a real decision before merging either away.

KNOWN LIMITATIONS (be honest about these, don't oversell the tool):
- This only catches duplication that shows up as shared FUNCTION
  CALLS. Two functions that reimplement the same logic using
  different primitives (e.g. one uses a regex, the other a manual
  loop, to do the same real-world check) will not be caught by this
  heuristic at all.
- The threshold (3+ shared dependencies) is a real, tunable choice,
  not a proven-optimal one. Lower it for a noisier, more complete
  sweep; raise it to cut noise at the cost of missing weaker
  candidates.
- This does not understand WHICH shared dependency matters. Two
  rendering functions sharing `addToCart`/`toast`/`renderIcon` (pure
  UI infrastructure) score the same as two functions sharing
  `detectIntentNLP`/`extractObject`/`resolveGroupFromIntent` (real,
  meaningful business logic) — manual review must make this
  distinction; the tool cannot.

USAGE: run from the repo root: python3 test_harness/find_duplicate_logic_candidates.py [--min-shared N]
"""
import re
import os
import sys

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def get_function_blocks(joined_src):
    func_blocks = {}
    for m in re.finditer(r'function\s+(\w+)\s*\([^)]*\)\s*\{', joined_src):
        name = m.group(1)
        start = m.start()
        depth = 0
        for j in range(m.end() - 1, len(joined_src)):
            if joined_src[j] == '{':
                depth += 1
            elif joined_src[j] == '}':
                depth -= 1
                if depth == 0:
                    func_blocks[name] = joined_src[start:j + 1]
                    break
    return func_blocks


def get_real_dependencies(func_blocks, min_deps=3):
    known_fns = set(func_blocks.keys())
    deps = {}
    for name, body in func_blocks.items():
        called = set(re.findall(r'\b(\w+)\(', body)) & known_fns
        called.discard(name)
        if len(called) >= min_deps:
            deps[name] = called
    return deps


def find_candidates(deps, min_shared=3):
    candidates = []
    names = list(deps.keys())
    for i in range(len(names)):
        for j in range(i + 1, len(names)):
            shared = deps[names[i]] & deps[names[j]]
            if len(shared) >= min_shared:
                candidates.append((names[i], names[j], shared))
    candidates.sort(key=lambda c: -len(c[2]))
    return candidates


if __name__ == '__main__':
    min_shared = 3
    if '--min-shared' in sys.argv:
        idx = sys.argv.index('--min-shared')
        min_shared = int(sys.argv[idx + 1])

    html = open(os.path.join(REPO_ROOT, 'qr.html')).read()
    scripts = re.findall(r'<script(?:\s[^>]*)?>(.*?)</script>', html, re.DOTALL)
    joined = '\n'.join(scripts)

    func_blocks = get_function_blocks(joined)
    deps = get_real_dependencies(func_blocks, min_deps=min_shared)
    candidates = find_candidates(deps, min_shared=min_shared)

    print(f"=== {len(candidates)} real pairs of functions sharing {min_shared}+ identical real dependencies ===")
    print("(genuine candidates for 'might be doing the same job twice' -- check each by hand)\n")
    for a, b, shared in candidates:
        print(f"  {a} <-> {b}")
        print(f"    shared: {sorted(shared)}")
    print(f"\nTotal real functions scanned: {len(func_blocks)}")
    print("Remember: a shared-infrastructure pair (UI helpers like toast/renderIcon) is")
    print("a false positive; a shared-BUSINESS-LOGIC pair (NLP/resolution functions) is")
    print("the real, worthwhile signal. Manual review must make this distinction.")
