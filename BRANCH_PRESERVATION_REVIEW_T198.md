# BRANCH_PRESERVATION_REVIEW_T198.md — what the repository's branches actually contain (2026-11-08)

Inspected from a bare `--mirror` clone of `tommichael88/booktomnyc` (full history, all refs), not from this checkout. Nothing was merged, rewritten or force-pushed. No remote-tracking ref was pruned.

## Counts, and where "about 23" comes from
- **Remote branches now: 8 listed below + 5 new `archive/precleanup/*` = 13.** Before this review: 8 (`main`, `master`, `fix/charter-compliance-qr`, `legacy-archive`, `review/product-first-claude-guidance-20261105`, `docs/t198-product-audit-and-preserve-branches`, and the two T198 work branches `t198-a1-masonry-mount-identity`, `t198-a2-formula-precedence`).
- **Local branches in this checkout: 3** (`main` and the two T198 work branches). Tags: **0** (local and remote).
- **The "about 23" is almost certainly pull requests, not branches:** GitHub holds 25 `refs/pull/N/head` refs (PRs #1–#26, #22 is an issue). All 26 PRs are closed and merged; their head commits are still fetchable from GitHub even though the branches (`t174-landing`, `t173-followup`, dependabot, `alert-autofix-*`, …) were deleted at merge. No local unpushed work or stash exists.

## Inventory
| Branch | Tip | Last commit | Relation to `main` | Unique content | PR / workflow / deploy use | Disposition |
|---|---|---|---|---|---|---|
| `main` | `2edbbec` | 2026-11-08 | — | the product | Pages deploy + CodeQL run on `main` | KEEP ACTIVE |
| `master` | `cacd164` | 2026-06-29 | **unrelated history** (no merge base), 2 commits | an earlier `v8 compiled schema` snapshot: 62 files under `Documents/scripts/booktomnyc/` (`qr.html`, `btnyc.json`, `nlp_engine.js`, `orchestrator_engine.js`, `pricing_engine.js`, tests) | no PR, no workflow | **PRESERVE HISTORICAL** (never delete without your ruling) |
| `fix/charter-compliance-qr` | `7cd7bd9` | 2026-10-17 | merge base `4d04bb5`; 1 ahead / 80 behind | one commit, "read PAX config from SSOT instead of embedding base64; isolate prototype externally". **Its `qr.html` is a 73-line truncated stub** (the file says "body truncated in source copy"): 12,949 lines removed, 11 added. Merging it would delete the application page. `main`'s `qr.html` has no embedded base64 (0 matches), so the stated intent is already met. | no PR, no workflow | **PRESERVE HISTORICAL**; do not merge; **REVIEW WITH OPERATOR** only if you want it deleted |
| `legacy-archive` | `df7352a` | 2026-10-16 | ancestor of `main` (0 ahead / 106 behind) | an older readable snapshot | no PR, no workflow | **PRESERVE HISTORICAL** |
| `review/product-first-claude-guidance-20261105` | `7cff8af` | 2026-11-05 | 2 ahead / 22 behind (PR #24, squash-merged) | `CLAUDE.md` only, later superseded by PR #25's `CLAUDE.md` | PR #24 closed; no workflow | **ARCHIVED REDUNDANT** (archive branch exists; deletion waits on your OK, see below) |
| `docs/t198-product-audit-and-preserve-branches` | `7a2acd9` | 2026-11-06 | 3 ahead / 14 behind (PR #25, merged) | `CLAUDE.md`, `NEXT_SESSION_BRIEF.md`: both byte-identical to `main` | PR #25 closed; no workflow | **ARCHIVED REDUNDANT** (same) |
| `t198-a1-masonry-mount-identity` | `3223328` | 2026-11-07 | rebased copy of this work is on `main` | nothing not on `main` | none | ARCHIVED REDUNDANT; leave until you say |
| `t198-a2-formula-precedence` | `769c245` | 2026-11-08 | pre-rebase copy; final is on `main` | nothing not on `main` | none | ARCHIVED REDUNDANT; leave until you say |

Files worth retaining: everything under `master:Documents/`; `fix/charter-compliance-qr` as a whole commit (the idea of reading PAX data from the catalog, and the isolated prototype page).

## Preservation (done)
Durable branches at the exact original tip SHAs, each fetched back from a fresh repository with its full history:

| Ref | SHA | Commits |
|---|---|---|
| `archive/precleanup/master` | `cacd164071775976ca985bd09e9a3a6eee955398` | 2 |
| `archive/precleanup/fix-charter-compliance-qr` | `7cd7bd9b2345de7309684c8ce38b1aea994b7554` | 3,229 |
| `archive/precleanup/legacy-archive` | `df7352a71ac4c80c8ce6a75f7994240565da7800` | 3,202 |
| `archive/precleanup/review-product-first-claude-guidance-20261105` | `7cff8af5dd7b5872863510843537d9bf5557a1ae` | 3,288 |
| `archive/precleanup/docs-t198-product-audit-and-preserve-branches` | `7a2acd96c00644f74481aed83281ced0d9cc47b3` | 3,297 |

Tags were tried first and the repository refused the push (HTTP 403 on tags), so they are branches. Pull-request refs `pull/24/head` and `pull/25/head` also hold the two doc branches' tips.

## Deletions
**Done: none.** Eligible under the brief and **waiting for your word** (the delete was refused by the session's permission layer, and I did not work around it): remote `review/product-first-claude-guidance-20261105` (`7cff8af5dd7b5872863510843537d9bf5557a1ae`) and remote `docs/t198-product-audit-and-preserve-branches` (`7a2acd96c00644f74481aed83281ced0d9cc47b3`). Not eligible, not touched: `master`, `fix/charter-compliance-qr`, `legacy-archive`.
