/**
 * _shared.js
 *
 * Standardized test-framework internals for JS verifiers in this harness.
 * Per Part 2 of the decision-registry proposal: the tests themselves stay
 * in the language of the code they test, but the check()/finish()
 * machinery, decision-tagging, failure formatting, and state-file writes
 * are identical across _shared.js and _shared.py.
 *
 * Usage in a verifier:
 *   const { check, finish } = require('./_shared.js');
 *   check('some real assertion', condition, { decision: 'D-dmg_size-not-symptom' });
 *   ... more checks ...
 *   finish(); // prints summary, writes RESULTS/failures.jsonl entries, exits
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const TEST_DIR = __dirname;
const REPO_ROOT = path.dirname(TEST_DIR);
const RESULTS_DIR = path.join(TEST_DIR, 'RESULTS');
const DECISIONS_PATH = path.join(TEST_DIR, 'decisions.json');
const FAILURES_PATH = path.join(RESULTS_DIR, 'failures.jsonl');

if (!fs.existsSync(RESULTS_DIR)) {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
}

let _decisions = null;
function loadDecisions() {
    if (_decisions !== null) return _decisions;
    try {
        const raw = JSON.parse(fs.readFileSync(DECISIONS_PATH, 'utf8'));
        _decisions = raw;
    } catch (e) {
        _decisions = {};
    }
    return _decisions;
}

function getQrBuildVersion() {
    try {
        // T158: QR_BUILD_VERSION now lives in an external module (modules/nlp_engine.js), so read the page as the browser runs it (see _page.js)
        const qr = require('./_page.js').readPage(path.join(REPO_ROOT, 'qr.html'));
        const m = qr.match(/QR_BUILD_VERSION\s*=\s*'([^']+)'/);
        return m ? m[1] : 'unknown';
    } catch (e) {
        return 'unknown';
    }
}

// Per-file test state, reset at module load (each verifier process is fresh)
const _state = {
    testFile: path.basename(process.argv[1] || 'unknown'),
    pass: 0,
    fail: 0,
    checks: [],
};

/**
 * check(label, condition, opts?)
 *   label: string describing the assertion
 *   condition: boolean
 *   opts: { decision?: string, expected?: any, got?: any }
 *     decision: a D-xxx id from decisions.json. When provided and the
 *       check fails, the human-readable view (invariant, why_dangerous,
 *       charter/timeline refs, changed dependencies) prints to console,
 *       and a minimal record is appended to RESULTS/failures.jsonl for
 *       an AI investigator to look up by id -- the full context is
 *       deliberately NOT inlined into every failure line.
 */
function check(label, condition, opts = {}) {
    if (condition) {
        _state.pass++;
        console.log(`  \u2713 ${label}`);
    } else {
        _state.fail++;
        console.log(`  \u2717 ${label}`);
        if (opts.decision) {
            printDecisionContext(opts.decision);
        }
        appendFailureRecord(label, opts);
    }
    _state.checks.push({ label, passed: !!condition, decision: opts.decision || null });
    return !!condition;
}

function printDecisionContext(decisionId) {
    const decisions = loadDecisions();
    const d = decisions[decisionId];
    if (!d) {
        console.log(`    \u26a0 decision '${decisionId}' referenced but not found in decisions.json`);
        return;
    }
    console.log(`    \u2192 [${decisionId}] ${d.invariant || '(no invariant recorded)'}`);
    if (d.why_dangerous) console.log(`      Why this matters: ${d.why_dangerous}`);
    if (d.charter_refs && d.charter_refs.length) console.log(`      Charter: ${d.charter_refs.join(', ')}`);
    if (d.timeline_refs && d.timeline_refs.length) console.log(`      Timeline: ${d.timeline_refs.join(', ')}`);
    if (d.confidence) console.log(`      Registry confidence: ${d.confidence}`);
}

function appendFailureRecord(label, opts) {
    const record = {
        at: new Date().toISOString(),
        test_file: _state.testFile,
        label,
        decision: opts.decision || null,
        expected: opts.expected !== undefined ? opts.expected : null,
        got: opts.got !== undefined ? opts.got : null,
    };
    try {
        fs.appendFileSync(FAILURES_PATH, JSON.stringify(record) + '\n');
    } catch (e) {
        // Non-fatal -- don't let RESULTS/ write issues mask the real test failure
    }
}

/**
 * finish(suiteName?)
 * Prints the standard summary line and exits with the standard code
 * (0 if all passed, 1 otherwise) -- matching every existing verifier's
 * own convention, so this is a drop-in for the check()/summary pattern
 * already used throughout the harness, not a new one to learn.
 */
function finish(suiteName) {
    const name = suiteName || _state.testFile;
    const total = _state.pass + _state.fail;
    console.log(`\n[${name}] ${_state.pass} passed, ${_state.fail} failed (of ${total} checks)\n`);
    process.exit(_state.fail > 0 ? 1 : 0);
}

/**
 * envelope(tool, summary, findings)
 * Standard shape for any generated RESULTS/*.json output, per Part 2:
 * {tool, generated_at, qr_build_version, summary, findings}
 */
function envelope(tool, summary, findings) {
    return {
        tool,
        generated_at: new Date().toISOString(),
        qr_build_version: getQrBuildVersion(),
        summary,
        findings,
    };
}

function sha256Short(filePath) {
    try {
        const content = fs.readFileSync(filePath);
        return crypto.createHash('sha256').update(content).digest('hex').slice(0, 16);
    } catch (e) {
        return null;
    }
}

module.exports = {
    check,
    finish,
    envelope,
    loadDecisions,
    sha256Short,
    getQrBuildVersion,
    REPO_ROOT,
    TEST_DIR,
    RESULTS_DIR,
};
