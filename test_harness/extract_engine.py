#!/usr/bin/env python3
"""
extract_engine.py — regenerates test_harness/_extracted_engine.js from qr.html.

No hand-maintained FUNCS list. The extractor:

  1. Tokenizes every inline <script> block in qr.html — strings, comments,
     and regex literals are recognised so brace/paren/bracket depth is
     counted correctly (a `/` after an identifier is division; elsewhere
     it opens a regex).
  2. Indexes every TOP-LEVEL function declaration and every TOP-LEVEL
     const/let/var declaration.
  3. Starts from PUBLIC_API (below) and walks each entry point's identifier
     references, resolving each to a top-level function or constant,
     recursively. This is the transitive closure of what the entry points
     need in order to run without ReferenceError.
  4. Emits reachable constants first (in original source order), then
     reachable functions (in original source order). Function declarations
     hoist in JavaScript, so their relative order is irrelevant; constants
     do NOT hoist, so they must be initialised before any function that
     reads them actually runs — which is exactly what the ordering gives.

Adding a name to PUBLIC_API is now the ONLY manual step. Every helper it
calls and every module-level constant it reads — including ones added
later — is discovered automatically. This eliminates the class of bug the
old hardcoded FUNCS list kept producing: a resolver or constant introduced
next to a function the extractor already pulls can no longer silently drop
out of the sandbox, because the extractor no longer knows a fixed list of
names to look for.

T151 corrections (found by checking the index against a real parser, acorn, on the current qr.html -- the first version indexed 136 of 206 top-level
functions and reported 145 local variables as top-level constants, and emitted a file that failed `node --check`):
  * template literals are scanned RE-ENTRANTLY: `${...}` may contain quotes, braces and further template literals (the old scan ended a template at the first
    inner backtick and read the rest of the file with the string/code states swapped);
  * `/` after return/typeof/case/... opens a regex, not a division (the old rule mis-read `return /{x}/.test(s)` and drifted the brace depth);
  * identifiers used only inside `${...}` count as references (they were invisible to the closure walk);
  * `async function` keeps its `async`; `const a = 1, b = 2` indexes both names;
  * the output is written to a temp file, syntax-checked, and only then moved into place, so a failed run can never leave a broken _extracted_engine.js behind;
  * `--index-json PATH` dumps the index so verify_extractor_index_matches_parser.js can compare it with the parser's ground truth on every run.

Usage:  python3 extract_engine.py [--index-json PATH]
Exit 0 on success; non-zero if qr.html cannot be read or contains no
inline <script> blocks.
"""

import os
import re
import subprocess
import sys


REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
QR_HTML = os.path.join(REPO_ROOT, "qr.html")
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "_extracted_engine.js")


# ─── The public surface of the extracted module ──────────────────────
# The test harness consumes exactly these names via require(). Adding
# one here is safe and self-contained: the whole dependency tree comes
# with it.
PUBLIC_API = [
    "computeUnifiedQuote",
    "applyPricingFormula",
    "resolveBaseConfidenceStrategy",
    "resolveServiceCheckoutStateKey",
    "deriveComplexityTier",
    "applyLiveConfidenceEscalation",
    "mathFurnitureAssembly",
    "buildCheckoutStateModel",   # T150: was resolveCheckoutState; renamed because it never resolved anything
    "resolveDynamicService",
]


# Names the emitted preamble already provides (as implicit globals). If
# qr.html also declares these with let/var/const, we must NOT re-emit
# them: a `let DB = null;` at the top of the extracted file would shadow
# the real value the preamble assigns.
PREAMBLE_PROVIDED = {"DB", "SERVICE_DATA", "S"}


# ─────────────────────────────────────────────────────────────────────
# Tokenizer
# ─────────────────────────────────────────────────────────────────────

REGEX_AFTER_KEYWORDS = {"return", "typeof", "case", "do", "else", "in", "of", "new", "delete", "void", "throw", "yield", "await", "instanceof"}


def scan_template(src, i):
    """`i` is just past the opening backtick. Returns (end, inner_ident_tokens).

    `${...}` is scanned with the real tokenizer, so quotes, braces and nested
    template literals inside an expression cannot desynchronise the string/code
    states. Identifiers found inside expressions are returned so the closure
    walk sees references that appear only there."""
    n = len(src)
    inner = []
    while i < n:
        c = src[i]
        if c == "\\":
            i += 2
            continue
        if c == "`":
            return i + 1, inner
        if c == "$" and i + 1 < n and src[i + 1] == "{":
            depth, closed, prev = 1, False, None
            for kind, value, s, e in tokenize(src, i + 2):
                if kind == "punct" and value == "{":
                    depth += 1
                elif kind == "punct" and value == "}":
                    depth -= 1
                    if depth == 0:
                        i, closed = e, True
                        break
                elif (kind == "ident" and value not in ("function", "const", "let", "var")
                      and not (prev is not None and prev[0] == "punct" and prev[1] == ".")):
                    inner.append(("ident", value, s, e))
                prev = (kind, value)
            if not closed:
                return n, inner
            continue
        i += 1
    return n, inner


def tokenize(src, start_at=0):
    """Yield (kind, value, start, end) for each significant token.

    kind ∈ {'ident', 'punct', 'string', 'number', 'regex'}.
    Whitespace and comments are skipped. `end` is exclusive, so
    src[start:end] is exactly the token's source text.
    """
    i, n = start_at, len(src)
    prev_sig = ""  # last significant character, for regex/divide disambiguation
    prev_kw = False  # last token was a keyword after which `/` opens a regex

    while i < n:
        c = src[i]

        # whitespace
        if c in " \t\r\n":
            i += 1
            continue

        # line comment
        if c == "/" and i + 1 < n and src[i + 1] == "/":
            while i < n and src[i] != "\n":
                i += 1
            continue

        # block comment
        if c == "/" and i + 1 < n and src[i + 1] == "*":
            end = src.find("*/", i + 2)
            i = n if end < 0 else end + 2
            continue

        # template literal: scanned re-entrantly (see scan_template)
        if c == "`":
            start = i
            end, inner = scan_template(src, i + 1)
            yield ("string", src[start:end], start, end)
            for tok in inner:
                yield tok
            i = end
            prev_sig = "S"
            prev_kw = False
            continue

        # string literal (' ")
        if c in ('"', "'"):
            start = i
            quote = c
            i += 1
            while i < n:
                if src[i] == "\\":
                    i += 2
                    continue
                if src[i] == quote:
                    i += 1
                    break
                if quote != "`" and src[i] == "\n":
                    break  # unterminated on this line; treat as closed
                i += 1
            yield ("string", src[start:i], start, i)
            prev_sig = "S"
            prev_kw = False
            continue

        # identifier / keyword
        if c.isalpha() or c == "_" or c == "$":
            start = i
            while i < n and (src[i].isalnum() or src[i] in "_$"):
                i += 1
            yield ("ident", src[start:i], start, i)
            prev_sig = "I"
            prev_kw = src[start:i] in REGEX_AFTER_KEYWORDS
            continue

        # numeric literal
        if c.isdigit():
            start = i
            while i < n and (src[i].isalnum() or src[i] in "._"):
                i += 1
            yield ("number", src[start:i], start, i)
            prev_sig = "N"
            prev_kw = False
            continue

        # `/` — regex or divide
        if c == "/":
            if prev_sig in ("I", "N", "S", ")", "]") and not prev_kw:
                yield ("punct", "/", i, i + 1)
                i += 1
                prev_sig = "/"
                prev_kw = False
                continue
            start = i
            i += 1
            in_class = False
            while i < n:
                rc = src[i]
                if rc == "\\":
                    i += 2
                    continue
                if rc == "[":
                    in_class = True
                elif rc == "]":
                    in_class = False
                elif rc == "/" and not in_class:
                    i += 1
                    break
                elif rc == "\n":
                    break
                i += 1
            while i < n and src[i].isalpha():
                i += 1
            yield ("regex", src[start:i], start, i)
            prev_sig = "R"
            prev_kw = False
            continue

        # any other single-character punctuation
        yield ("punct", c, i, i + 1)
        prev_sig = c
        prev_kw = False
        i += 1


# ─────────────────────────────────────────────────────────────────────
# Top-level declaration index
# ─────────────────────────────────────────────────────────────────────

def find_top_level_decls(tokens):
    """Return (funcs, consts). Each maps name -> (first_tok, last_tok, char_start, char_end).

    Only declarations at brace depth 0 within the concatenated script
    source are recorded. Nested declarations inside other functions or
    blocks are ignored — they cannot be reached by a name-based walk
    from an entry point anyway.
    """
    funcs, consts = {}, {}
    depth = 0
    i, n = 0, len(tokens)

    while i < n:
        kind, value, _, _ = tokens[i]

        if kind == "punct":
            if value == "{":
                depth += 1
                i += 1
                continue
            if value == "}":
                depth -= 1
                i += 1
                continue

        if depth == 0 and kind == "ident":
            # function NAME(...) { ... }
            if value == "function" and i + 1 < n and tokens[i + 1][0] == "ident":
                # A function EXPRESSION (e.g. the boot IIFE `(async function init() {...})()`) is not a declaration and binds no top-level name:
                # look at what precedes the keyword (skipping `async`).
                pi = i - 1
                if pi >= 0 and tokens[pi][0] == "ident" and tokens[pi][1] == "async":
                    pi -= 1
                if pi >= 0 and ((tokens[pi][0] == "punct" and tokens[pi][1] in "(=:,[!&|?+-*%<>~^")
                                or (tokens[pi][0] == "ident" and tokens[pi][1] in REGEX_AFTER_KEYWORDS)):
                    i += 1
                    continue
                name = tokens[i + 1][1]

                # Locate the body's opening brace, tracking paren depth so
                # a default value like `{a: 1}` in the parameter list does
                # not look like the body.
                j = i + 2
                paren = 0
                while j < n:
                    kk, vv, _, _ = tokens[j]
                    if kk == "punct" and vv == "(":
                        paren += 1
                    elif kk == "punct" and vv == ")":
                        paren -= 1
                    elif kk == "punct" and vv == "{" and paren == 0:
                        break
                    j += 1
                if j >= n:
                    i += 1
                    continue

                # Brace-match the body to its closing `}`.
                bd = 0
                k = j
                while k < n:
                    kk, vv, _, _ = tokens[k]
                    if kk == "punct" and vv == "{":
                        bd += 1
                    elif kk == "punct" and vv == "}":
                        bd -= 1
                        if bd == 0:
                            break
                    k += 1
                if k >= n:
                    i += 1
                    continue

                fi = i - 1 if (i > 0 and tokens[i - 1][0] == "ident" and tokens[i - 1][1] == "async") else i  # keep `async`
                funcs[name] = (fi, k, tokens[fi][2], tokens[k][3])
                i = k + 1
                continue

            # const NAME = ...;  (also let / var)
            if value in ("const", "let", "var") and i + 1 < n and tokens[i + 1][0] == "ident":
                name = tokens[i + 1][1]
                j = i + 2
                p = b = br = 0  # paren, brace, bracket depths
                while j < n:
                    kk, vv, _, _ = tokens[j]
                    if kk == "punct":
                        if vv == "(":
                            p += 1
                        elif vv == ")":
                            p -= 1
                        elif vv == "[":
                            br += 1
                        elif vv == "]":
                            br -= 1
                        elif vv == "{":
                            b += 1
                        elif vv == "}":
                            b -= 1
                        elif p == 0 and b == 0 and br == 0:
                            if vv == ";":
                                break
                            if vv == "}":
                                # ASI: no semicolon before an enclosing close
                                j -= 1
                                break
                    elif kk == "ident" and p == 0 and b == 0 and br == 0 and vv in ("const", "let", "var", "function"):
                        # ASI: next top-level declaration begins
                        j -= 1
                        break
                    j += 1
                if j >= n:
                    j = n - 1

                consts[name] = (i, j, tokens[i][2], tokens[j][3])
                # `const a = 1, b = 2;` -- index every declarator against the same statement
                p2 = b2 = br2 = 0
                for q in range(i + 2, j + 1):
                    kq, vq, _, _ = tokens[q]
                    if kq != "punct":
                        continue
                    if vq == "(": p2 += 1
                    elif vq == ")": p2 -= 1
                    elif vq == "[": br2 += 1
                    elif vq == "]": br2 -= 1
                    elif vq == "{": b2 += 1
                    elif vq == "}": b2 -= 1
                    elif vq == "," and p2 == 0 and b2 == 0 and br2 == 0 and q + 1 <= j and tokens[q + 1][0] == "ident":
                        consts.setdefault(tokens[q + 1][1], (i, j, tokens[i][2], tokens[j][3]))
                i = j + 1
                continue

        i += 1

    return funcs, consts


# ─────────────────────────────────────────────────────────────────────
# Reference collection and closure walk
# ─────────────────────────────────────────────────────────────────────

def collect_refs(tokens, first, last):
    """Every identifier mentioned in tokens[first:last] (inclusive).

    Member accesses (`.foo`) and the name bound by a `function` keyword
    are excluded: neither is a reference to a top-level binding.
    Over-inclusion is safe (a stray name just adds an unused declaration
    to the bundle); under-inclusion is not, so we err wide.
    """
    refs = set()
    for i in range(first, last + 1):
        kind, value, _, _ = tokens[i]
        if kind != "ident":
            continue
        if i > first:
            pk, pv, _, _ = tokens[i - 1]
            if pk == "punct" and pv == ".":
                continue
            if pk == "ident" and pv == "function":
                continue
        refs.add(value)
    return refs


def build_closure(entries, funcs, consts, tokens):
    """Names reachable from `entries` by walking identifier references
    through top-level function and constant declarations."""
    needed_funcs, needed_consts = set(), set()
    worklist = list(entries)

    while worklist:
        name = worklist.pop()
        if name in funcs and name not in needed_funcs:
            needed_funcs.add(name)
            first, last, _, _ = funcs[name]
        elif name in consts and name not in needed_consts:
            needed_consts.add(name)
            first, last, _, _ = consts[name]
        else:
            continue

        for ref in collect_refs(tokens, first, last):
            if ref in funcs and ref not in needed_funcs:
                worklist.append(ref)
            elif ref in consts and ref not in needed_consts:
                worklist.append(ref)

    return needed_funcs, needed_consts


# ─────────────────────────────────────────────────────────────────────
# Emission
# ─────────────────────────────────────────────────────────────────────

def emit(source, funcs, consts, needed_funcs, needed_consts):
    # Source order, so the emitted file reads top-to-bottom like the original.
    const_list, seen_extents = [], set()
    for n in sorted(needed_consts, key=lambda n: consts[n][2]):
        ext = (consts[n][2], consts[n][3])
        if ext not in seen_extents:  # a multi-declarator statement is emitted once
            seen_extents.add(ext)
            const_list.append(n)
    func_list = sorted(needed_funcs, key=lambda n: funcs[n][2])

    parts = [
        "// AUTO-GENERATED by extract_engine.py — do not edit by hand.",
        "// Regenerate with: python3 extract_engine.py",
        "//",
        "// Entry points are the only hand-declared names; every helper and",
        "// module-level constant below was discovered by walking identifier",
        "// references from those entry points.",
        "",
        "DB = global.DB;",
        "SERVICE_DATA = global.SERVICE_DATA;",
        "global.window = global.window || global;  // resolveDynamicService reads window.DB directly",
        "S = global.S = { _svc: null };",
        "",
    ]

    if const_list:
        parts.append("// ─── Module-level constants (source order) ───")
        for name in const_list:
            _, _, cs, ce = consts[name]
            parts.append(source[cs:ce])
        parts.append("")

    if func_list:
        parts.append("// ─── Functions (source order) ───")
        for name in func_list:
            _, _, cs, ce = funcs[name]
            parts.append(source[cs:ce])
            parts.append("")

    parts.append("module.exports = { " + ", ".join(PUBLIC_API) + " };")
    return "\n".join(parts) + "\n"


# ─────────────────────────────────────────────────────────────────────
# qr.html <script> extraction
# ─────────────────────────────────────────────────────────────────────

def extract_inline_scripts(html):
    """Every inline JS body from qr.html, in document order.

    Skips external scripts (`src=...`) and non-JS blocks
    (application/json, text/template, application/ld+json).
    """
    bodies = []
    for m in re.finditer(r"<script\b([^>]*)>(.*?)</script>", html, re.DOTALL):
        attrs, body = m.group(1), m.group(2)
        if re.search(r"\bsrc\s*=", attrs):
            continue
        if re.search(r'\btype\s*=\s*["\'](application/json|text/template|application/ld\+json)', attrs):
            continue
        bodies.append(body)
    return bodies


# ─────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────

def main():
    if not os.path.isfile(QR_HTML):
        print(f"ERROR: qr.html not found at {QR_HTML}", file=sys.stderr)
        return 1

    # T158: "qr.html" is the page as a browser runs it -- its external <script src> files (modules/*.js) in place. The URL-to-file rule is stated once, in
    # _page.js; this asks it (a missing file is an error there, never a silent skip).
    page = subprocess.run(["node", os.path.join(os.path.dirname(os.path.abspath(__file__)), "_page.js"), QR_HTML], capture_output=True, text=True, encoding="utf-8")
    if page.returncode != 0:
        print(f"ERROR: could not assemble the page: {page.stderr.strip()}", file=sys.stderr)
        return 1
    html = page.stdout

    bodies = extract_inline_scripts(html)
    if not bodies:
        print("ERROR: no inline <script> blocks found in qr.html", file=sys.stderr)
        return 1

    # Concatenate with explicit separators so two adjacent top-level
    # statements from neighbouring blocks can never merge.
    source = "\n;\n".join(bodies)
    tokens = list(tokenize(source))
    funcs, consts = find_top_level_decls(tokens)

    # Report what we indexed (useful when a name looks unexpectedly absent).
    print(f"Indexed {len(funcs)} top-level function(s), {len(consts)} top-level constant(s).")
    if "--index-json" in sys.argv:
        import json
        path = sys.argv[sys.argv.index("--index-json") + 1]
        with open(path, "w", encoding="utf-8") as jf:
            json.dump({"funcs": sorted(funcs), "consts": sorted(consts)}, jf)
        print(f"Wrote index to {path}")
        return 0

    # Verify every entry point resolves before walking anything.
    missing_entries = [n for n in PUBLIC_API if n not in funcs]
    if missing_entries:
        print(f"ERROR: entry point(s) not found as top-level functions in qr.html: "
              f"{', '.join(missing_entries)}", file=sys.stderr)
        return 1

    needed_funcs, needed_consts = build_closure(PUBLIC_API, funcs, consts, tokens)
    # Never emit the preamble's own bindings, even if the source declares
    # them with let/var/const — the preamble's assignments must win.
    needed_consts -= PREAMBLE_PROVIDED

    print(f"Closure from {len(PUBLIC_API)} entry point(s): "
          f"{len(needed_funcs)} function(s), {len(needed_consts)} constant(s).")

    output = emit(source, funcs, consts, needed_funcs, needed_consts)

    # Write to a temp file, syntax-check THAT, and only then move it into place: a failed run must never leave a broken _extracted_engine.js behind.
    tmp = os.path.join(os.path.dirname(OUT), "_extracted_engine.check.js")
    with open(tmp, "w", encoding="utf-8") as out:
        out.write(output)
    try:
        r = subprocess.run(["node", "--check", tmp], capture_output=True, text=True, timeout=20)
        if r.returncode != 0:
            print("ERROR: node --check on the extracted file reported errors; the existing _extracted_engine.js was left untouched:", file=sys.stderr)
            print(r.stderr, file=sys.stderr)
            os.remove(tmp)
            return 1
    except (FileNotFoundError, subprocess.TimeoutExpired):
        pass  # node not available; skip the syntax check
    os.replace(tmp, OUT)

    print(f"Wrote {OUT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())