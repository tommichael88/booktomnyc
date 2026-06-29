#!/usr/bin/env bash
#
# run_all.sh — the master pre-push verification script.
# Executes entirely from within the system/testing directory.
#
# USAGE:
#   ./run_all.sh (from system/testing) OR ../system/testing/run_all.sh (from root)

set -uo pipefail
ROOT_DIR="/home/tmnero/Documents/scripts/booktomnyc/"

# Force the script to switch to this directory immediately
cd "$ROOT_DIR" || { echo "Error: Could not enter $ROOT_DIR"; exit 1; }


# 1. Move to the directory where this script resides.
# This ensures all subsequent relative paths resolve correctly.


# 2. Setup Reporting
TOTAL_SUITES=0
FAILED_SUITES=0
FAILED_NAMES=()

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
RESET='\033[0m'


# Hardcoded absolute path

# Now all your relative checks (e.g., [ -f "btnyc.json" ]) 
# will effectively look inside /home/tmnero/Documents/scripts/booktomnyc/
# Add this function to run_all.sh
audit_directory_dependencies() {
    local target_dir="/home/tmnero/Documents/scripts/booktomnyc"
    
    echo -e "━━━ Auditing: $target_dir ━━━"
    
    # Check for specific files in the exact directory
    local files_to_check=("pricing_engine.js" "orchestrator_engine.js" "btnyc.json")
    
    for file in "${files_to_check[@]}"; do
        if [ -f "$target_dir/$file" ]; then
            echo -e "✅ Found: $file"
        else
            echo -e "❌ Missing: $file"
        fi
    done
}

run_suite() {
    local name="$1"
    shift
    TOTAL_SUITES=$((TOTAL_SUITES + 1))
    echo ""
    echo -e "${BOLD}━━━ ${name} ━━━${RESET}"
    # Execute the command locally within this directory
    if "$@" 2>&1; then
        echo -e "${GREEN}✓ ${name} passed${RESET}"
    else
        echo -e "${RED}✗ ${name} FAILED${RESET}"
        FAILED_SUITES=$((FAILED_SUITES + 1))
        FAILED_NAMES+=("$name")
    fi
}



# ── 0. Pre-flight: Data Transformation ──────────────────────────────────
# Path: relative to this directory
if [ -f "transform_btnyc.py" ]; then
    run_suite "Data Transformation (JSON -> Engine)" \
        python3 transform_btnyc.py

    if [ "$FAILED_SUITES" -gt 0 ]; then
        echo -e "${RED}${BOLD}CRITICAL: Transformation failed. Aborting.${RESET}"
        exit 1
    fi
fi

# ── 1. Schema + reference validation ────────────────────────────────────
if [ -f "btnyc_master_deprecated.py" ]; then
    run_suite "Schema & reference validation" \
        python3 btnyc_master_deprecated.py ../btnyc.json --validate
fi

# ── 2. Pricing-engine cross-engine vectors ──────────────────────────────
if [ -f "run_vectors.js" ]; then
    run_suite "Pricing regression vectors" \
        node run_vectors.js
fi

# ── 3. JS regression suite (verify_*.js) ────────────────────────────────
echo ""
echo -e "${BOLD}━━━ JS regression suite (verify_*.js) ━━━${RESET}"
for f in verify_*.js; do
    [[ "$f" == "verify_contextual_override_word_order_fix.js" ]] && continue
    [[ "$f" == "verify_dumb_ui_html_self_sufficiency.js" ]] && continue
    [[ "$f" == "verify_btnyc_v5_compiler.js" ]] && continue
    [ -e "$f" ] || continue
    run_suite "$f" node "$f"
done

# ── 4. Python-specific tests ────────────────────────────────────────────
echo ""
echo -e "${YELLOW}━━━ Python-specific tests ━━━${RESET}"
for f in verify_*.py; do
    [[ "$f" == "transform_btnyc.py" ]] && continue
    [[ "$f" == "verify_btnyc_v7_compiler.py" ]] && continue
    [[ "$f" == "verify_btnyc_v8_compiler.py" ]] && continue
    [[ "$f" == "verify_compiled_output_against_real_schema.py" ]] && continue
    [ -e "$f" ] || continue
    run_suite "$f" python3 "$f"
done

# ── Summary ───────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
if [ "$FAILED_SUITES" -eq 0 ]; then
    echo -e "${GREEN}${BOLD}ALL CLEAR — ${TOTAL_SUITES}/${TOTAL_SUITES} suites passed.${RESET}"
else
    echo -e "${RED}${BOLD}${FAILED_SUITES}/${TOTAL_SUITES} suite(s) FAILED:${RESET}"
    for n in "${FAILED_NAMES[@]}"; do
        echo -e "${RED}  ✗ ${n}${RESET}"
    done
    echo ""
    echo -e "${RED}${BOLD}DO NOT PUSH.${RESET} Investigate failures above."
fi
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"

exit $([ "$FAILED_SUITES" -eq 0 ] && echo 0 || echo 1)
