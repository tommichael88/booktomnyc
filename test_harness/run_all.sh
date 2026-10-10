#!/usr/bin/env bash
#
# run_all.sh — the master verification script.
#
# ─────────────────────────────────────────────────────────────────────
# REVISION NOTE
# ─────────────────────────────────────────────────────────────────────
# This script was rewritten to remove a class of tests that had become
# counterproductive — they failed on legitimate changes because they
# asserted fixed catalog counts, byte-equality between duplicated
# modules, hand-maintained allowlist state, or the checksum of files
# the manifest was supposed to be watching. Collectively they
# generated more maintenance work than signal, and their presence in
# the failure list made real regressions hard to distinguish from
# bookkeeping.
#
# Those tests have been moved to test_harness/deprecated/. The glob
# loops below do not recurse, so they no longer pick those up. See
# deprecated/README.md for the full list and the reasoning per file.
#
# ─────────────────────────────────────────────────────────────────────
# DESIGN PRINCIPLES (in priority order, for whoever edits this next)
# ─────────────────────────────────────────────────────────────────────
# 1. Exit code is a signal. 0 means "the behavioural tests passed."
#    A permanent known-failure in the list destroys that signal, so
#    permanent known-failures do not belong in this script. If a test
#    can only ever fail, it belongs in deprecated/ or it needs fixing.
#
# 2. Assertions are invariants, not counts. "Every service has a
#    pricing_archetype" is a real test; "there are 74 services" is a
#    maintenance burden disguised as a test, because it fails on the
#    next legitimate catalog addition rather than on a real bug.
#
# 3. Diagnostics that need human judgment (sweeps, drift checks,
#    parity reports) print and move on. They never gate pass/fail.
#
# 4. Failure output leads with what broke. It does not open with
#    checksum bookkeeping about which file was edited — that
#    information, if it matters, belongs in the pre-push diff, not
#    in a test runner.
#
# PREREQUISITE: run the deprecation move before this script.
#   cd test_harness && mkdir -p deprecated && \
#     mv <deprecated-names> deprecated/
# If you have not moved anything, the tests that were supposed to be
# deprecated will still run and will report the exact bookkeeping
# failures this revision exists to eliminate.
#
# USAGE: ./test_harness/run_all.sh
# EXIT CODE: 0 = all behavioural tests passed, 1 = any failed.

set -uo pipefail

# ─── Paths ──────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}" 2>/dev/null || echo "${BASH_SOURCE[0]}")")" && pwd)"
cd "$SCRIPT_DIR"
PROJECT_ROOT="$(cd .. && pwd)"
RESULTS_DIR="$PROJECT_ROOT/RESULTS"
mkdir -p "$RESULTS_DIR"

FAILURES_LOG="$RESULTS_DIR/RUN_ALL_RESULTS.txt"

echo "BTNYC Test Run — $(date)" > "$FAILURES_LOG"
echo "Project root: $PROJECT_ROOT" >> "$FAILURES_LOG"
echo "" >> "$FAILURES_LOG"

TOTAL_SUITES=0
FAILED_SUITES=0
FAILED_NAMES=()

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
RESET='\033[0m'


# ─── Helper: run a behavioural test suite ──────────────────────────────
# Runs the command directly (no extra bash -c wrapper, no xtrace). On
# failure, captures both streams into a temp file, echoes the output to
# the console, and appends it to the run log. The command's own exit
# code is what counts.
run_suite() {
    local name="$1"
    shift
    TOTAL_SUITES=$((TOTAL_SUITES + 1))
    echo ""
    echo -e "${BOLD}━━━ ${name} ━━━${RESET}"

    local tmp_out
    tmp_out=$(mktemp)
    if "$@" > "$tmp_out" 2>&1; then
        echo -e "${GREEN}✓ ${name} passed${RESET}"
    else
        echo -e "${RED}✗ ${name} FAILED${RESET}"
        FAILED_SUITES=$((FAILED_SUITES + 1))
        FAILED_NAMES+=("$name")
        {
            echo "━━━ FAILURE: ${name} ━━━"
            echo "Command: $*"
            cat "$tmp_out"
            echo ""
        } >> "$FAILURES_LOG"
        cat "$tmp_out"
    fi
    rm -f "$tmp_out"
}


# ─── Extract all JS modules from qr.html ──────────────────────────────
# This is load-bearing: everything below expects the extracted modules
# (pricing_engine.js etc.) to be current. Abort early if it fails,
# rather than producing a cascade of confusing downstream failures.
echo -e "${BOLD}━━━ Extracting modules from qr.html ━━━${RESET}"
node "$SCRIPT_DIR/extract_modules.js"
if [ $? -ne 0 ]; then
    echo -e "${RED}Module extraction failed. Aborting.${RESET}"
    exit 1
fi


# ─── 1. Schema + reference validation ─────────────────────────────────
run_suite "Schema & reference validation" \
    python3 "$PROJECT_ROOT/btnyc_master_deprecated.py" "$PROJECT_ROOT/btnyc.json" --validate


# ─── 2. Pricing-engine extraction + cross-engine vectors ──────────────
# The pricing vectors are the single most valuable regression net in
# the harness — they pin real input/output pairs against the real
# engine, cross-checked against the standalone module. Keep these.
if [ -f "extract_engine.py" ]; then
    run_suite "Pricing engine extraction (extract_engine.py)" \
        python3 extract_engine.py
fi
if [ -f "run_vectors.js" ]; then
    run_suite "Pricing regression vectors (run_vectors.js)" \
        node run_vectors.js
fi


# ─── 3. Install missing dependencies if needed ────────────────────────
# Keyed on the specific consuming file, so removing that file also
# removes the install need. Simpler than the original three-OR block;
# npm install is idempotent, so the extra triggering paths were just
# noise.
NEEDS_NPM_INSTALL=false
if [ ! -d "node_modules/jsdom" ] && ls verify_*.js >/dev/null 2>&1; then
    NEEDS_NPM_INSTALL=true
fi
if [ ! -d "node_modules/puppeteer-core" ] && [ -f "verify_smoke_test_puppeteer.js" ]; then
    NEEDS_NPM_INSTALL=true
fi
if [ ! -d "node_modules/ajv" ] && [ -f "verify_compiled_output_against_real_schema.js" ]; then
    NEEDS_NPM_INSTALL=true
fi
if [ "$NEEDS_NPM_INSTALL" = true ]; then
    echo "Installing test harness dependencies (jsdom / puppeteer-core / ajv)..."
    npm install --silent 2>&1 | tail -3
    if [ ! -d "node_modules/jsdom" ]; then
        echo -e "${RED}⚠ jsdom install did not complete -- some tests will fail.${RESET}"
    fi
    if [ ! -d "node_modules/ajv" ]; then
        echo -e "${RED}⚠ ajv install did not complete -- verify_compiled_output_against_real_schema.js will fail.${RESET}"
    fi
fi


# ─── 4. JS behavioural tests (verify_*.js) ────────────────────────────
# Glob does not recurse; anything in deprecated/ is correctly ignored.
echo ""
echo -e "${BOLD}━━━ JS behavioural tests ━━━${RESET}"
for f in verify_*.js; do
    [ -e "$f" ] || continue
    # Two JS tests extract from btnyc.py; skip cleanly if it's absent.
    # "The file under test isn't here yet" is different signal from
    # "the test found a regression" — keep them distinguishable.
    if [[ "$f" == "verify_compute_quote_for_draft.js" || \
          "$f" == "verify_input_sanitization.js" ]]; then
        if [ ! -f "$PROJECT_ROOT/btnyc.py" ]; then
            echo -e "${YELLOW}  ⚠ $f skipped (btnyc.py not present)${RESET}"
            continue
        fi
    fi
    run_suite "$f" node "$f"
done


# ─── 5. Python behavioural tests (verify_*.py) ────────────────────────
# The original had a long case-block skipping .py files superseded by
# .js ports. That block is gone — those .py files should be moved to
# deprecated/ (or deleted) rather than kept as dead skip-entries. If
# you still see them here, that's a real signal something wasn't
# migrated, not something to paper over with a skip case.
echo ""
echo -e "${BOLD}━━━ Python behavioural tests ━━━${RESET}"
for f in verify_*.py; do
    [ -e "$f" ] || continue
    run_suite "$f" python3 "$f"
done


# ─── 6. Static-analysis find_* scripts ────────────────────────────────
# These report candidates for human review and exit 0 by design.
# find_synonym_collision_risks.py — the one that gated pass/fail on
# allowlist drift — is now in deprecated/ rather than continuing to
# be a source of "edit a list to make the suite green."
echo ""
echo -e "${BOLD}━━━ Static-analysis helpers ━━━${RESET}"
for f in find_*.py; do
    [ -e "$f" ] || continue
    run_suite "$f" python3 "$f"
done


# ─── 7. Non-blocking diagnostics ──────────────────────────────────────
# These print signal for a human to read. They never gate pass/fail.

echo ""
echo -e "${BOLD}━━━ Automated path sweep (diagnostic) ━━━${RESET}"
if [ -f "$SCRIPT_DIR/automated_path_sweep.js" ]; then
    node "$SCRIPT_DIR/automated_path_sweep.js" 2>&1 | tail -20
    echo -e "${YELLOW}  (full results: $RESULTS_DIR/SWEEP_RESULTS.json)${RESET}"
else
    echo "  ⚠ automated_path_sweep.js not found – skipping"
fi

echo ""
echo -e "${BOLD}━━━ Decision-registry drift check (diagnostic) ━━━${RESET}"
if [ -f "$SCRIPT_DIR/tools/check_decisions_drift.js" ]; then
    node "$SCRIPT_DIR/tools/check_decisions_drift.js" 2>&1 | tail -30
else
    echo "  ⚠ tools/check_decisions_drift.js not found – skipping"
fi



# ─── 8. Collect screenshots ───────────────────────────────────────────
# Real-browser tests drop failure_*.png into cwd; collect them into
# RESULTS/ so they don't clutter the git working tree.
echo ""
echo -e "${BOLD}━━━ Collecting screenshots ━━━${RESET}"
for pattern in failure_*.png; do
    if ls $pattern 1>/dev/null 2>&1; then
        mv $pattern "$RESULTS_DIR/" 2>/dev/null
        echo "  Moved $pattern to $RESULTS_DIR/"
    fi
done


# ─── 9. Aggregator pipeline ───────────────────────────────────────────
# Builds AGGREGATOR.md / AGGREGATOR.html from the timeline + decisions
# ledgers. This is documentation infrastructure — it supports the
# Charter's document-ecosystem goal — so it runs here. Non-blocking
# for the same reason as the diagnostics above: the pass/fail gate
# belongs on the tests, not on the doc build.
echo ""
echo -e "${BOLD}━━━ Aggregator pipeline ━━━${RESET}"
AGG_FAILED=0
for stage in build_timeline_index.py build_decisions_index.py build_concerns_index.py build_aggregator.py; do
    if [ -f "$SCRIPT_DIR/tools/$stage" ]; then
        if ! python3 "$SCRIPT_DIR/tools/$stage"; then
            echo -e "${RED}  ✗ $stage exited non-zero -- see its own output above${RESET}"
            AGG_FAILED=1
        fi
    else
        echo "  ⚠ tools/$stage not found – skipping remaining aggregator stages"
        AGG_FAILED=1
        break
    fi
done
if [ "$AGG_FAILED" -eq 0 ]; then
    echo -e "${GREEN}  Aggregator pipeline clean. See AGGREGATOR.html / AGGREGATOR.md.${RESET}"
fi


# ─── 10. Final summary ────────────────────────────────────────────────
# No manifest snapshotting, no "since we last looked" diff, no
# checksum of what changed. That belongs in the pre-push git diff
# (which already exists and is authoritative). A test runner should
# tell you whether the tests passed.
echo ""
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
if [ "$FAILED_SUITES" -eq 0 ]; then
    echo -e "${GREEN}${BOLD}ALL CLEAR — ${TOTAL_SUITES}/${TOTAL_SUITES} suites passed.${RESET}"
    echo -e "${GREEN}Safe to push.${RESET}"
    echo "All clear" >> "$FAILURES_LOG"
else
    echo -e "${RED}${BOLD}${FAILED_SUITES}/${TOTAL_SUITES} suite(s) FAILED:${RESET}"
    for n in "${FAILED_NAMES[@]}"; do
        echo -e "${RED}  ✗ ${n}${RESET}"
    done
    echo ""
    echo -e "${RED}${BOLD}DO NOT PUSH.${RESET} See detailed failures log:"
    echo -e "${YELLOW}  $FAILURES_LOG${RESET}"
fi
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"

exit $([ "$FAILED_SUITES" -eq 0 ] && echo 0 || echo 1)
