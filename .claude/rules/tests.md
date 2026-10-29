---
paths:
  - "test_harness/**"
---

# Tests

- `./run_all.sh` is the gate. `MASTER_TEST_SUITE.json` is the membership list — a test that disappears without being retired fails the suite.
- A red test on the baseline stays red. A *new* red is a regression. Do not silence either.
- The gate tolerates known failures; that does not mean any failure is acceptable. Read the gate output and separate pass / known-red / environment-gap.
- `archive/suite_T*.tsv` records are historical snapshots. Do not edit.
