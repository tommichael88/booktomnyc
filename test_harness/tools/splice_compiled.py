#!/usr/bin/env python3
"""
splice_compiled.py -- regenerate the compiler-owned keys of btnyc.json WITHOUT moving any other byte.

Why this exists (T164).  btnyc.json is hand-edited and is not a fixed point under json.dumps(indent=2): inline objects
the operator and earlier tickets formatted by hand would be reflowed if the compiler's own output file replaced it.
The compiler (btnyc_v10_compiler.py) is "genuinely additive": every key it does not own comes out unchanged.  So the
only keys that ever need to change when the compiler is re-run are the ones it owns, and this tool replaces exactly
those text spans in the file and leaves every other byte alone.

    python3 test_harness/tools/splice_compiled.py [btnyc.json]            # dry run: what would change, per owned key
    python3 test_harness/tools/splice_compiled.py [btnyc.json] --write    # write it in place

What it checks before it writes (any failure exits 1 and writes nothing):
  1. the compiler runs and reports a valid schema (an invalid result is never written);
  2. every key the compiler does not own is equal in the compiler's output and in the file (additive);
  3. the spliced text parses, and equals the compiler's output as a whole object;
  4. every byte outside the owned keys' spans is byte-identical to the input.
"""
import json
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
COMPILER = HERE.parent / "btnyc_v10_compiler.py"
# The keys btnyc_v10_compiler.py writes (its COMPILER_OWN_KEYS).
OWN = ["compiled", "routing_archetypes", "pricing_archetypes", "_compiler_metadata", "_validation",
       "_additive_diff", "_schema_validation", "_archetype_mismatch_report"]


def top_spans(text):
    """[(key, value_start, value_end)] for the members of the top-level object, in file order."""
    dec = json.JSONDecoder()
    i = text.index("{") + 1
    out = []
    while True:
        while text[i] in " \t\r\n,":
            i += 1
        if text[i] == "}":
            return out
        key, i = dec.raw_decode(text, i)
        while text[i] in " \t\r\n":
            i += 1
        assert text[i] == ":", f"expected ':' after {key!r}"
        i += 1
        while text[i] in " \t\r\n":
            i += 1
        _, end = dec.raw_decode(text, i)
        out.append((key, i, end))
        i = end


def main(argv):
    write = "--write" in argv
    args = [a for a in argv if not a.startswith("--")]
    ssot = Path(args[0]) if args else Path("btnyc.json")
    raw = ssot.read_text(encoding="utf-8")
    cur = json.loads(raw)

    with tempfile.TemporaryDirectory() as d:
        out_file = Path(d) / "compiled.json"
        proc = subprocess.run([sys.executable, str(COMPILER), str(ssot), str(out_file)], capture_output=True, text=True)
        if proc.returncode != 0 or not out_file.exists():
            print(proc.stdout + proc.stderr)
            print("FAIL: the compiler did not produce an output")
            return 1
        comp_text = out_file.read_text(encoding="utf-8")
    comp = json.loads(comp_text)

    fails = []
    if not (comp.get("_schema_validation") or {}).get("valid"):
        fails.append(f"the compiler reports an invalid schema: {(comp.get('_schema_validation') or {}).get('errors', [])[:3]}")
    if set(cur) != set(comp):
        fails.append(f"top-level key set differs: only in file {[k for k in cur if k not in comp]}, only in compiler {[k for k in comp if k not in cur]}")
    for k in cur:
        if k not in OWN and k in comp and cur[k] != comp[k]:
            fails.append(f"the compiler changed a key it does not own: {k}")
    if fails:
        print("\n".join("FAIL: " + f for f in fails))
        return 1

    raw_spans = {k: (s, e) for k, s, e in top_spans(raw)}
    comp_spans = {k: (s, e) for k, s, e in top_spans(comp_text)}
    pieces, pos, report = [], 0, []
    for k, (s, e) in sorted(((k, raw_spans[k]) for k in OWN if k in raw_spans), key=lambda kv: kv[1][0]):
        new = comp_text[comp_spans[k][0]:comp_spans[k][1]]
        pieces.append(raw[pos:s])
        pieces.append(new)
        pos = e
        report.append((k, e - s, len(new), raw[s:e] == new))
    pieces.append(raw[pos:])
    result = "".join(pieces)

    # verification
    back = json.loads(result)
    if back != comp:
        fails.append("the spliced file does not equal the compiler's output as an object")
    res_spans = {k: (s, e) for k, s, e in top_spans(result)}
    for k in cur:
        if k in OWN:
            continue
        if result[res_spans[k][0]:res_spans[k][1]] != raw[raw_spans[k][0]:raw_spans[k][1]]:
            fails.append(f"bytes moved in a key the tool must not touch: {k}")
    if fails:
        print("\n".join("FAIL: " + f for f in fails))
        return 1

    changed = [r for r in report if not r[3]]
    for k, a, b, same in report:
        print(f"  {k:28s} {a:>9d} -> {b:>9d} bytes  {'unchanged' if same else 'REGENERATED'}")
    print(f"{len(changed)} of {len(report)} compiler-owned keys differ; every other byte is unchanged ({len(raw)} -> {len(result)} bytes)")
    if write:
        if changed:
            ssot.write_text(result, encoding="utf-8")
            print(f"wrote {ssot}")
        else:
            print("nothing to write")
    else:
        print("dry run: nothing written (pass --write)")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
