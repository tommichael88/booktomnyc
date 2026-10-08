#!/usr/bin/env python3
"""
purity_audit.py — call-graph-aware purity analysis of qr.html's functions.

A function is DIRECTLY impure if its own body contains a DOM/storage marker.
A function is TRANSITIVELY impure if it calls (directly or indirectly) any
directly-impure function. Only functions that are neither are genuinely safe
to move into a pure PricingEngine module untouched.

This matters because a marker-only check (no `document.` in MY body) badly
overstates purity — e.g. removeServiceFromCart has no DOM marker itself but
calls renderCart(), which is saturated with document.createElement calls.
"""
import re
import json

with open("../qr.html", encoding="utf-8") as f:
    html = f.read()
scripts = re.findall(r"<script(?:\s[^>]*)?>(.*?)</script>", html, re.DOTALL)


def find_brace_block(src, start_idx, open_close_idx):
    depth = 0
    for j in range(open_close_idx, len(src)):
        if src[j] == "{":
            depth += 1
        elif src[j] == "}":
            depth -= 1
            if depth == 0:
                return src[start_idx:j + 1]
    return None


def find_all_functions(src):
    results = []
    for m in re.finditer(r"function\s+(\w+)\s*\([^)]*\)\s*\{", src):
        body = find_brace_block(src, m.start(), m.end() - 1)
        if body:
            results.append((m.group(1), body))
    for m in re.finditer(r"(?:const|let|var)\s+(\w+)\s*=\s*\([^)]*\)\s*=>\s*\{", src):
        body = find_brace_block(src, m.start(), m.end() - 1)
        if body:
            results.append((m.group(1), body))
    # v9.4: one-liner (implicit-return, no braces) arrow functions, e.g.
    # `const q = (sel, ctx = document) => (ctx || document).querySelector(sel);`
    # These were previously invisible to this analyzer entirely — not just
    # misclassified as pure, but never registered as a function at all,
    # which also meant call-graph propagation could never see through them.
    # Matched up to the first statement-ending `;` at depth 0 (no nested
    # parens/braces still open) or end of line, whichever comes first —
    # good enough for the genuinely one-line helpers in this file; multi-
    # line one-liners (rare) may be truncated, but that only risks under-
    # counting impurity markers within them, not over-claiming purity for
    # something that's actually impure but missed entirely (the worse
    # failure mode this whole rewrite is guarding against).
    for m in re.finditer(r"(?:const|let|var)\s+(\w+)\s*=\s*\([^)]*\)\s*=>\s*(?!\{)", src):
        name = m.group(1)
        if name in {n for n, _ in results}:
            continue  # already found as a block-body version elsewhere
        line_end = src.find("\n", m.end())
        if line_end == -1:
            line_end = len(src)
        body = src[m.start():line_end]
        results.append((name, body))
    return results


all_fns = {}
for s in scripts:
    for name, body in find_all_functions(s):
        if name not in all_fns:
            all_fns[name] = body

DOM_MARKERS = re.compile(
    r"\bdocument\."
    r"|\bwindow\.(?!DB)"
    r"|\balert\("
    r"|\bconfirm\("
    r"|\bprompt\("
    r"|getElementById"
    r"|querySelector"
    r"|addEventListener"
    r"|\.innerHTML\b"
    r"|\.style\."
    r"|createElement"
    r"|classList"
    r"|localStorage"
    r"|sessionStorage"
    # v9.4: global mutable session-state writes are a third impurity class
    # beyond DOM/storage — a function that mutates the global S or State
    # object is not safe to treat as pure math even if it never touches the
    # DOM directly (e.g. applySSOTRules mutates S.manTagIds/S.detTagIds/
    # S.negatedTagIds in place; enforceRequires does the same). Caught here
    # rather than via a separate pass so transitive propagation covers it too.
    r"|\bS\.\w+\s*="
    r"|\bS\.\w+\.push\("
    r"|\bS\.\w+\[\w*\]\s*="
    r"|\bState\.\w+\s*="
    r"|\bState\.\w+\.push\("
    # v9.4: closures over locally-scoped DOM element variables (e.g.
    # `livePriceEl.textContent = ...`, `addBtn.disabled = ...` inside a
    # nested function whose outer scope captured those elements via
    # document.getElementById earlier) don't match document./window.
    # directly but are still genuine DOM writes. Property-name markers
    # below are common enough in this codebase to be a reliable signal
    # without false-flagging ordinary data-object property assignment.
    r"|\.textContent\s*="
    r"|\.disabled\s*="
    r"|\.checked\s*="
    r"|\.value\s*=(?!=)"
)

names = set(all_fns.keys())
name_call_re = {n: re.compile(r"\b" + re.escape(n) + r"\s*\(") for n in names}


def direct_calls(body, self_name):
    found = set()
    for n, pat in name_call_re.items():
        if n == self_name:
            continue
        if pat.search(body):
            found.add(n)
    return found


direct_impure = {}
call_graph = {}
for name, body in all_fns.items():
    direct_impure[name] = bool(DOM_MARKERS.search(body))
    call_graph[name] = direct_calls(body, name)

_cache = {}


def is_transitively_impure(name, _visiting=None):
    if name in _cache:
        return _cache[name]
    if _visiting is None:
        _visiting = set()
    if name in _visiting:
        return False
    _visiting.add(name)
    if direct_impure.get(name):
        _cache[name] = True
        return True
    for callee in call_graph.get(name, ()):
        if is_transitively_impure(callee, _visiting):
            _cache[name] = True
            return True
    _cache[name] = False
    return False


results = []
for name in sorted(all_fns.keys()):
    body = all_fns[name]
    lines = body.count("\n") + 1
    results.append({
        "name": name,
        "lines": lines,
        "direct_impure": direct_impure[name],
        "transitively_impure": is_transitively_impure(name),
        "calls": sorted(call_graph[name]),
    })

with open("../architecture_audit/purity_audit.json", "w") as f:
    json.dump(results, f, indent=2)

truly_pure = [r for r in results if not r["transitively_impure"]]
print(f"Total functions analyzed: {len(results)}")
print(f"Truly pure (no DOM, transitively): {len(truly_pure)}")
print(f"Transitively impure: {len(results) - len(truly_pure)}")
print()
print("=== TRULY PURE, sorted by size ===")
for r in sorted(truly_pure, key=lambda r: -r["lines"]):
    print(f"{r['lines']:4d} lines | {r['name']}")
