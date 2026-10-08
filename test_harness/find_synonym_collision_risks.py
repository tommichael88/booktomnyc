#!/usr/bin/env python3
"""
find_synonym_collision_risks.py

THE ROOT-CAUSE FIX for PENDING_DECISIONS #37/#38 (T113), not another
one-word patch.

#37 ("dish washer" misrouting to washer_repair) was fixed at T112, one
case at a time, because the fix required understanding and safely
constraining detectIntentNLP's own scoring/tie-break mechanics -- that
part cannot be automated away. But the QUESTION "which catalog phrase
should I worry about next" can be, and should be: 214 of this catalog's
360 synonyms (59%) are multi-word, and EVERY one of them is a structural
candidate for accidentally containing a DIFFERENT entry's own bare
keyword -- the exact shape #37 was. That count grows with the catalog by
construction, not with any specific word, which is exactly why chasing
individual words is a losing game as this catalog scales.

This script recomputes the FULL, precise list of that risk on every run
(matching the *exact* logic that made #37 real, not an approximation),
compares it against known_synonym_collision_risks.json (the
already-reviewed state as of T113, 37 pairs), and:
  - exits 0 (informational only) if nothing changed -- the 37 known
    pairs are UNVERIFIED candidates, not confirmed bugs (same status as
    PENDING_DECISIONS #38), so they do not block the suite on their own.
  - exits 1 (a real failure) the moment a NEW, unacknowledged pair
    appears -- e.g. the next time this catalog grows and a new
    multi-word synonym is added that collides with an existing keyword.
    That failure is the whole point: it converts "silently resurfaces
    someday, discovered via a customer complaint or another audit" into
    "caught at data-authoring time, before it ships."

This does not replace individually triaging the 37 already-known
candidates (or the eventual, separate, larger question of whether
detectIntentNLP's own matching architecture should be restructured to
prevent this class of collision at match-time rather than catch it at
data-authoring time -- see PENDING_DECISIONS #38's own note on that
larger, deliberately-deferred option). It replaces having no mechanism
at all for noticing when the list grows.
"""
import json
import re
import sys
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)


def word_boundary_contains(haystack, needle):
    return re.search(r'\b' + re.escape(needle) + r'\b', haystack) is not None


def compute_current_risk_pairs(db):
    """Mirrors detectIntentNLP's own matching shape exactly: a multi-word
    phrase (keyword or synonym) belonging to one entry that contains a
    DIFFERENT entry's bare keyword as a whole word, where that phrase does
    NOT also reinforce its own owning entry's keyword (self-reinforced
    cases are structurally safe -- see the T110/T111 "self-referential
    synonym" finding and the T112 fix's own comments for why), and is not
    already promoted to full_weight_synonyms (a promoted phrase has
    already been individually reviewed and deliberately given full
    weight -- not this script's concern)."""
    mappings = db.get('intent_mappings', {})
    entries = mappings.get('objects', mappings) if isinstance(mappings, dict) else mappings
    if not isinstance(entries, list):
        entries = []

    pairs = []
    for owner in entries:
        owner_kw = (owner.get('keyword') or '').lower()
        full_weight = set(s.lower() for s in owner.get('full_weight_synonyms', []) if isinstance(s, str))
        strings = [owner_kw] + [s.lower() for s in owner.get('synonyms', []) if isinstance(s, str)]
        for s in strings:
            if not s or ' ' not in s:
                continue  # only multi-word phrases are the risk surface
            for other in entries:
                if other is owner:
                    continue
                other_kw = (other.get('keyword') or '').lower()
                if not other_kw or other_kw == s:
                    continue
                if not word_boundary_contains(s, other_kw):
                    continue
                self_reinforced = bool(owner_kw) and word_boundary_contains(s, owner_kw)
                is_promoted = s in full_weight or s == owner_kw
                if self_reinforced or is_promoted:
                    continue
                pairs.append({
                    'ownerEntry': owner.get('keyword'),
                    'phrase': s,
                    'containsKeywordOf': other.get('keyword'),
                })
    return pairs


def pair_key(p):
    return (p['ownerEntry'], p['phrase'], p['containsKeywordOf'])


def main():
    with open(os.path.join(PROJECT_ROOT, 'btnyc.json')) as f:
        db = json.load(f)
    allowlist_path = os.path.join(SCRIPT_DIR, 'known_synonym_collision_risks.json')
    with open(allowlist_path) as f:
        allowlist = json.load(f)

    current = compute_current_risk_pairs(db)
    current_keys = set(pair_key(p) for p in current)
    known_keys = set(pair_key(p) for p in allowlist['acknowledgedPairs'])

    new_pairs = [p for p in current if pair_key(p) not in known_keys]
    resolved_keys = known_keys - current_keys  # known pairs that no longer exist (fixed, promoted, or removed)

    print("=== Synonym collision-risk check (T113 root-cause fix for PENDING_DECISIONS #37/#38) ===")
    print(f"  Catalog entries scanned: {len(db.get('intent_mappings', {}).get('objects', []))}")
    print(f"  Current risk pairs (multi-word, unpromoted, non-self-reinforcing): {len(current)}")
    print(f"  Already acknowledged (known_synonym_collision_risks.json): {len(known_keys)}")

    if resolved_keys:
        print(f"\n  {len(resolved_keys)} previously-acknowledged pair(s) no longer present (fixed, promoted, or removed since last review) -- consider removing from the allowlist to keep it accurate:")
        for k in resolved_keys:
            print(f"    - {k[0]!r} / {k[1]!r} / {k[2]!r}")

    if not new_pairs:
        print("\n  No NEW, unacknowledged collision risks. All current pairs were already reviewed as of the allowlist's last recompute.")
        print("  (This does not mean the 37 known pairs are safe -- only that nothing has changed. See PENDING_DECISIONS #38.)")
        return 0

    print(f"\n  \u2717 {len(new_pairs)} NEW, UNACKNOWLEDGED collision risk(s) found -- this is a real failure, not noise:")
    for p in new_pairs:
        print(f"    NEW: {p['ownerEntry']!r}'s synonym {p['phrase']!r} contains {p['containsKeywordOf']!r}'s own keyword.")
        print(f"         If a customer types {p['phrase']!r} without also typing {p['ownerEntry']!r}, they may be misrouted --")
        print(f"         confirmed real for the identical shape at PENDING_DECISIONS #37 (dish washer -> washer_repair).")
    print("\n  Before this can pass: either fix it directly (promote the phrase to full_weight_synonyms")
    print("  if genuinely unambiguous, or a detectIntentNLP-level fix if a tie/collision remains -- see the")
    print("  T112 fix's own code comment for the pattern), or add it to known_synonym_collision_risks.json")
    print("  with a reason if it's reviewed and judged safe as-is. Do not silently ignore it.")
    return 1


if __name__ == '__main__':
    sys.exit(main())
