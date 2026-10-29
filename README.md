# BTNYC — BookTOM NYC

Home-service quoting platform. The single-file page is `qr.html`; the catalog is `btnyc.json`; the entity-first source is `ssot/btnyc_source.json`.

## Start here
1. `PROJECT_CHARTER.html` — the Constitution
2. `COMPONENT_LAYER_MAP.md` — architecture
3. `TIMELINE.md` — work history (read the newest entries)
4. `PENDING_DECISIONS.md` — open decisions
5. `HANDOFF_CURRENT_STATE.md` — state at last closeout

## Local setup
    npm install --prefix test_harness
    pip install -r test_harness/requirements.txt
    cd test_harness && ./run_all.sh

## For agents
See `CLAUDE.md` at the root and `.claude/` for the rules and settings.

## Live
https://tommichael88.github.io/booktomnyc/qr
