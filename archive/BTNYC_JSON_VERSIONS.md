# Versions of `btnyc.json`: where each one is, and how to compare any two

Written in T180 (8/n) at the Operator's request (2026-10-16 23:34 NY): "I'd rather audit the data in case someone has to compare your `btnyc.json` to the previous version in case of oversight in the future."

## How to compare two versions

```
node test_harness/tools/catalog_diff.js list                       # every version in history (below, as a table with --md)
node test_harness/tools/catalog_diff.js diff <A> <B> [--all]       # what changed: per collection added / removed / changed, then every money-or-time field that moved
node test_harness/tools/catalog_diff.js diff b7fff909 HEAD         # the first restored version against now
node test_harness/tools/catalog_diff.js diff HEAD~1 btnyc.json     # the last committed version against the working file
node test_harness/tools/catalog_diff.js diff legacy/catalogs/btnyc_v10_final.json btnyc.json   # an older catalogue against now
```

`A` and `B` are a git revision (the file read is `btnyc.json` at that revision), `REV:path` (any other file at a revision), or a file path on disk. The tool is read-only and is held by `verify_catalog_diff.js` (it reports a known set of edits exactly, reports nothing for identical files, and lists a changed fee and a changed price among the money fields while leaving a wording-only change out).

## The versions in this repository's history (`git log -- btnyc.json`, newest first)

| commit | date | meta.version | bytes | blob | services | modifiers | tags | modules | subject |
|---|---|---|---|---|---|---|---|---|---|
| `52b1082e` | 2026-10-12 | 9.6.0 | 1526808 | `d03aaa6c59` | 76 | 189 | 59 | 135 | T174 (5/n): #205 and #201 landed: the Computer Diagnostic is the registered $85 gateway; its Fork waits for th |
| `6a85537d` | 2026-10-12 | 9.6.0 | 1524472 | `87fedd128b` | 76 | 188 | 59 | 134 | T174 (4/n): #199 landed: a group declares its symptom question once; the picker, the builder, the card and the |
| `bea9d925` | 2026-10-12 | 9.6.0 | 1512480 | `9620d88417` | 76 | 188 | 59 | 131 | T174 (3/n): #204 landed: a diagnostic answer reaches the Fork on every entity and every way in; Path A draws i |
| `7e51ae0b` | 2026-10-11 | 9.6.0 | 1511124 | `c576e23c84` | 76 | 188 | 59 | 131 | T170 Part C: Tech Trouble > Computer Repair symptom-led intake that does not ask twice (#180) |
| `0ba99dfb` | 2026-10-11 | 9.6.0 | 1459563 | `75957a6224` | 76 | 188 | 44 | 123 | T170 Parts A+B: ceiling/tag-arbitration gateway fix (#178) and customer-observable questions (#179) |
| `534fe9af` | 2026-10-11 | 9.6.0 | 1453084 | `4a3ae1044e` | 76 | 182 | 44 | 122 | T169: #167 question and label pass (IHR duplicate, brand escape, fee out of a label, purpose on 8 modules); #1 |
| `fde902fc` | 2026-10-11 | 9.6.0 | 1452217 | `70d02fdc36` | 76 | 182 | 44 | 122 | T168: the dash sweep (#167 item 5, #170): no invisible lookalike in btnyc.json, no non-ASCII dash in an option |
| `3c919c4d` | 2026-10-10 | 9.6.0 | 1452513 | `e8bdc9a260` | 76 | 182 | 44 | 122 | T166: SSOT audit (btnyc.json structure, references, content; tag detection by whole words; tag rules in Logic) |
| `43468057` | 2026-10-10 | 9.6.0 | 1447126 | `b3d037a3d9` | 76 | 182 | 43 | 122 | T164: item G of the 2026-10-10 mandate (door_size and space_ready retired; the delta check is a detector; four |
| `0b89edf7` | 2026-10-10 | 9.6.0 | 1444881 | `0ff5eac326` | 76 | 182 | 43 | 124 | T164 prep: compiled.* regenerated on the unmodified SSOT (closes L1); the compiler finds its schema again |
| `43b22c8f` | 2026-10-10 | 9.6.0 | 1427111 | `e6e92244c0` | 76 | 182 | 43 | 124 | T159-T161: items B, C, D of the 2026-10-10 mandate (one confidence resolver, FALLBACKS in the SSOT, one escala |
| `b7fff909` | 2026-10-08 | 9.6.0 | 1421475 | `f652eb8fa1` | 76 | 182 | 43 | 124 | baseline: restore T156 package (history lost to container reset) |

The oldest row of history is `b7fff909` (2026-10-08), "baseline: restore T156 package (history lost to container reset)": the catalog's history before that date was lost in a container reset and is not in this repository's git history. Everything before it that survives is the older catalogs below.

## Older catalogs (retained, byte for byte)

Moved by T180 into `legacy/catalogs/` (their original paths and bytes are also in the branch `legacy-archive`, which holds the whole tree before the move; `legacy/INDEX.json` records each file's old path, new path and sha256):

`btnyc_v2.json`, `btnyc_v3.json`, `btnyc_v4.json`, `btnyc_v10_final.json`, `btnyc2.json`, `btnyc26.json`, `btnyc_services.json`, `booktom-ssot.json`, `booktom_catalog_v3_final.json`, `booktomnyc.json`, `services.json`, `services_catalog.json`, `services_new.json`, `new-services.json`, `new_services_restructured.json`, `new_services_restructured_with_rules.json`, `data.optimized.json`, `setmore-data.json`.

## The T166 audit data (branch `t166-ssot-audit`)

The branch's tip, `3c919c4d` ("T166: SSOT audit ..."), is an ancestor of `main`, so the branch's commits are in `main`'s history. Checked on 2026-10-17: every one of the branch's 338 files exists at the same path in `main`; the audit evidence (`archive/T166_golden_compare.txt`, `archive/T166_render_diff.txt`, `archive/T166_within_word_hazards.txt`, `archive/golden_change_T166_ssot_audit.md`, `archive/golden_master_T166_extended.json`, `archive/types_T166.txt`, `archive/suite_T160_C.tsv` to `archive/suite_T166.tsv`) is byte-identical in `main`; and `main`'s `archive/` differs from the branch's only by 99 added files (18,583 added lines, none removed or changed). The commit's own diff of `btnyc.json` (`git show 3c919c4d -- btnyc.json`) is the catalog change the audit made.

## Why deleting a branch that is inside `main` loses nothing

A branch is a movable label on a commit. When the branch's tip is an ancestor of `main`, every commit, file and version the branch holds is reached from `main`; deleting the label removes a name and no data. This was checked for each of the 23 branches with `git merge-base --is-ancestor <tip> origin/main` on a full (not shallow) clone. The tips are listed in `legacy/README.md`, so any of them can be recreated with `git branch <name> <sha>`. The branches `legacy-archive` (the pre-move tree) and `master` (two commits `main` does not have) are NOT among the 23 and should be kept.
