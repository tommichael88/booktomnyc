"""
btnyc_mutate.py — apply declarative mutations to btnyc.json with validation.

Usage:
    python btnyc_mutate.py path/to/btnyc.json batches/batch_01.py
    python btnyc_mutate.py path/to/btnyc.json batches/batch_01.py --dry-run
"""
import json, sys, argparse
from pathlib import Path


class Btnyc:
    def __init__(self, path):
        self.path = Path(path)
        self.data = json.loads(self.path.read_text())
        self._removed_modules = []
        self._added_module_keys = []

    # ---- removal ----
    def remove_intake_module(self, key):
        """Hard delete. Refuses if anything still references it."""
        refs = self._who_references_module(key)
        if refs:
            raise ValueError(
                f"Refusing to remove '{key}' — still referenced by: {refs}"
            )
        if key in self.data.get("intake_modules", {}):
            del self.data["intake_modules"][key]
            self._removed_modules.append(key)

    # ---- additions ----
    def add_intake_module(self, key, definition):
        """Add or replace a module. Marks it for post-apply validation."""
        self.data.setdefault("intake_modules", {})[key] = definition
        self._added_module_keys.append(key)

    def add_modifier(self, key, definition):
        self.data.setdefault("global_rules", {}).setdefault("modifiers", {})[key] = definition

    # ---- chain rewrites ----
    def set_service_chain(self, service_id, chain):
        svc = self._find_service(service_id)
        svc["intake_chain"] = chain

    def set_dynamic_chain(self, dyn_key, chain):
        self.data["dynamic_services"][dyn_key]["intake_chain"] = chain

    # ---- apply ----
    def apply(self, dry_run=False):
        errors = self._validate()
        if errors:
            print("VALIDATION FAILED:")
            for e in errors:
                print(f"  - {e}")
            sys.exit(1)
        if dry_run:
            print(f"DRY RUN OK — {len(self._removed_modules)} removed, "
                  f"{len(self._added_module_keys)} added/replaced")
            return
        self.path.write_text(json.dumps(self.data, indent=2))
        print(f"Wrote {self.path}")

    # ---- internals ----
    def _who_references_module(self, key):
        refs = []
        for s in self.data.get("services", []):
            for step in s.get("intake_chain", []):
                if step.get("module") == key:
                    refs.append(f"service:{s['id']}")
        for k, d in self.data.get("dynamic_services", {}).items():
            for step in d.get("intake_chain", []):
                if step.get("module") == key:
                    refs.append(f"dynamic:{k}")
        return refs

    def _find_service(self, service_id):
        for s in self.data.get("services", []):
            if s["id"] == service_id:
                return s
        raise KeyError(f"service '{service_id}' not found")

    def _validate(self):
        """Every module referenced by any chain must exist."""
        errors = []
        known = set(self.data.get("intake_modules", {}).keys())
        for s in self.data.get("services", []):
            for step in s.get("intake_chain", []):
                if step["module"] not in known:
                    errors.append(f"{s['id']} → unknown module '{step['module']}'")
        for k, d in self.data.get("dynamic_services", {}).items():
            for step in d.get("intake_chain", []):
                if step["module"] not in known:
                    errors.append(f"dynamic:{k} → unknown module '{step['module']}'")
        return errors


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("btnyc_path")
    ap.add_argument("batch_file")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    db = Btnyc(args.btnyc_path)
    # Each batch file is a Python module with an `apply(db)` function
    ns = {}
    exec(Path(args.batch_file).read_text(), ns)
    ns["apply"](db)
    db.apply(dry_run=args.dry_run)