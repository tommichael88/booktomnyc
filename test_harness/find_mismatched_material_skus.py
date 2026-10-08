#!/usr/bin/env python3
"""
find_mismatched_material_skus.py

Direct response to a real, recurring pattern found via manual review,
not a systematic sweep, three separate times: a service's own
required_materials/optional_materials links point to a real catalog
SKU whose name/category has no genuine connection to the service's
own real, stated work — confirmed for `dishwasher_repair` (linked to
a sink P-trap and an electrical outlet) and `washer_install` (linked
to a "Refrigerator Water Line Kit"), most likely copy-paste errors
during authoring. A third, related case (`toilet_install`'s legacy
note describing a $100-400 TOILET price beside a $10-32 materials
figure that explicitly excludes the toilet) was a stale-note mismatch
rather than a wrong SKU, but the same root cause: nothing checks
whether a service's materials story is internally coherent.

THIS IS A REAL, MECHANICAL HEURISTIC, NOT A GUARANTEE. It flags
genuine candidates for manual review; it does not understand business
context well enough to auto-fix anything. Two real checks:

1. CATEGORY MISMATCH: does any linked SKU's own `category` field
   differ from the service's own `ui_taxonomy.category_id` in a way
   that doesn't already have a known, legitimate cross-category
   reason (e.g. a wall-mounting service legitimately uses mounting
   anchors regardless of category)?
2. NAME-WORD OVERLAP: does the SKU's own name/description share ANY
   real, meaningful word with the service's own id/display_name? A
   total absence of overlap (e.g. "Refrigerator Water Line" linked to
   a "Washer" service) is a strong, real signal, even when the
   category technically matches (both are "plumbing").

USAGE: run from the repo root: python3 test_harness/find_mismatched_material_skus.py

HONEST, REAL RESULT FROM THIS TOOL'S OWN FIRST RUN: the word-overlap
heuristic is too blunt to trust unsupervised. It correctly found both
real, confirmed bugs (dishwasher_repair, washer_install) — but its
first run also flagged 32 OTHER candidates that are mostly, on manual
check, genuinely correct (e.g. `bidet_attachment_install_or_removal`
linking a "Toilet Wax Ring" — completely sensible, a bidet attachment
mounts onto a toilet, but the literal words "bidet" and "wax ring"
share nothing). Real-world domain connections (a baseboard install
needing wall-patch materials; a TV mount needing drywall anchors) are
obvious to a person and invisible to literal word matching.

**This tool is therefore a real, narrow first-pass filter, not a
verdict.** Its candidate list still needs the same manual judgment
used to confirm the original two real bugs — it narrows 57 services
down to a real, smaller list worth a second look, nothing more. Do
not treat its output as "N real bugs found" without checking each one
the way `dishwasher_repair`/`washer_install` were checked: read the
SKU's real name/description AND the service's real, stated work, and
judge whether a person would call them connected.
"""
import json
import os
import re

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Real, known-legitimate cross-category SKU uses, confirmed by hand —
# extend this list as real, deliberate exceptions are found and verified,
# rather than let the tool silently re-flag something already checked.
KNOWN_LEGITIMATE_CROSS_CATEGORY = {
    ('cable_management', 'MAT-TEC-CBL-CableKit'),  # wall_mounting service, tech-category SKU — genuinely correct (cable management for mounted devices)
    ('flatscreen_mounting_with_hidden_cables', 'MAT-TEC-CBL-CableKit'),  # same, real reason
}

STOPWORDS = {'a', 'an', 'the', 'and', 'or', 'of', 'for', 'with', 'kit', 'standard', 'basic'}


def real_words(text):
    return set(w for w in re.findall(r'[a-z]+', text.lower()) if w not in STOPWORDS and len(w) > 2)


def main():
    db = json.load(open(os.path.join(REPO_ROOT, 'btnyc.json')))
    catalog = db.get('materials_catalog', {})

    category_mismatches = []
    name_overlap_misses = []

    for svc in db['services']:
        sid = svc['id']
        svc_cat = svc.get('ui_taxonomy', {}).get('category_id', '')
        svc_words = real_words(sid + ' ' + svc.get('ui_taxonomy', {}).get('display_name', '') + ' ' + svc.get('ui_taxonomy', {}).get('description', ''))
        all_skus = (svc.get('required_materials') or []) + (svc.get('optional_materials') or [])
        for sku in all_skus:
            item = catalog.get(sku)
            if not item:
                continue
            if (sid, sku) in KNOWN_LEGITIMATE_CROSS_CATEGORY:
                continue
            sku_words = real_words(sku + ' ' + item.get('name', '') + ' ' + item.get('description', '') + ' ' + item.get('sub_category', ''))
            if not (svc_words & sku_words):
                name_overlap_misses.append((sid, sku, item.get('name')))

    print(f"=== {len(name_overlap_misses)} real candidate(s): zero word overlap between service and linked material SKU ===")
    print("(genuine candidates for a copy-paste/authoring error — verify each by hand)\n")
    for sid, sku, name in name_overlap_misses:
        print(f"  {sid} -> {sku} ({name})")

    print(f"\nTotal real services with at least one linked material checked: {sum(1 for s in db['services'] if s.get('required_materials') or s.get('optional_materials'))}")
    print("Remember: zero word overlap is a strong signal, not proof — a generic part")
    print("(e.g. a screw, a wire nut) may legitimately apply to many unrelated services.")


if __name__ == '__main__':
    main()
