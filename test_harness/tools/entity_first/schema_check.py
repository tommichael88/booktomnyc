#!/usr/bin/env python3
"""Structural validation of ssot/btnyc_source.json against schema/btnyc-source.schema.json (JSON Schema 2020-12).

    python3 -I schema_check.py <schema.json> <source.json>      # exit 0 valid, 1 invalid (findings on stdout as JSON lines), 2 could not run

The semantic rules the schema cannot say are validate_source.js. A failure to RUN is exit 2, never a pass.
"""
import json
import sys

try:
    from jsonschema import Draft202012Validator
except Exception as exc:  # noqa: BLE001
    print(json.dumps({"fatal": "python jsonschema is not importable: %s" % exc}))
    sys.exit(2)


def main(argv):
    if len(argv) != 3:
        print(json.dumps({"fatal": "usage: schema_check.py <schema> <source>"}))
        return 2
    # Anything that stops the check from RUNNING (a missing or corrupt schema or source, a schema that is not itself a valid schema) is exit 2. An uncaught exception would exit 1, which the caller
    # reads as "invalid with findings"; with nothing on stdout that would be read as no findings, i.e. a pass. A check that cannot run is never a pass (T175).
    try:
        with open(argv[1], encoding="utf-8") as fh:
            schema = json.load(fh)
        with open(argv[2], encoding="utf-8") as fh:
            source = json.load(fh)
        Draft202012Validator.check_schema(schema)
        errors = sorted(Draft202012Validator(schema).iter_errors(source), key=lambda e: [str(p) for p in e.absolute_path])
    except Exception as exc:  # noqa: BLE001
        print(json.dumps({"fatal": "the schema check could not run: %s: %s" % (type(exc).__name__, str(exc)[:200])}))
        return 2
    for e in errors[:200]:
        path = "$" + "".join("[%s]" % p if isinstance(p, int) else ".%s" % p for p in e.absolute_path)
        print(json.dumps({"path": path, "msg": e.message[:300]}))
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
