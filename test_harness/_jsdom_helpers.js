/**
 * _jsdom_helpers.js
 *
 * T135+. Direct response to a real, operator-reported class of test
 * harness failures: running the exact same, checksum-verified qr.html
 * in the operator's own local environment produced widespread "X is
 * undefined" failures (DB, window.__store, renderRoute, S, and several
 * page-level functions) that do NOT reproduce in this sandbox under
 * several tested hypotheses (real trace.js actually loading and
 * executing; a realistic 2.5s network delay on the btnyc.json fetch).
 *
 * The one clear, structural, generalizable problem found regardless of
 * the exact root cause: 8 separate test files each hand-roll their own
 * `setTimeout(..., 3000)` before asserting the app has finished its real,
 * async `init()`. That number was tuned against THIS sandbox's own
 * timing (network calls to blocked domains fail instantly here, so
 * there's effectively no real waiting to do) and was never a real
 * contract with the app itself. In any environment where a fetch takes
 * meaningfully longer -- a slower machine, a real network round trip to
 * a domain that doesn't fail instantly, a proxy, a VPN -- 3000ms is a
 * guess, not a guarantee, and the exact failure shape reported (no
 * errors thrown, core globals simply never get set) is precisely what
 * "the test asserted before init finished" looks like.
 *
 * This is the fix at the root, not eight separate patches at the leaf:
 * one shared helper that POLLS for the app's own real readiness signal
 * instead of guessing a fixed delay, with a generous ceiling and a
 * clear, diagnostic error if it's genuinely never reached (a real
 * failure, not a slow one, still gets reported as a real failure).
 *
 * USAGE (replaces `setTimeout(() => { ... }, 3000)`):
 *   const { waitForAppReady } = require('./_jsdom_helpers.js');
 *   await waitForAppReady(dom.window);
 *   // ... assertions ...
 */

// The real, load-bearing globals every one of the 8 affected tests was
// actually waiting for, confirmed directly against qr.html's own real
// init() sequence and store.js/AppController.js's own real global
// assignments -- not guessed.
const READINESS_SIGNALS = ['DB', '__store', 'renderRoute', 'S'];

function isReady(window) {
    return READINESS_SIGNALS.every(name => typeof window[name] !== 'undefined');
}

/**
 * Poll `window` until every readiness signal is defined, or until
 * `maxWaitMs` elapses. Resolves as soon as ready (often much faster than
 * a fixed delay would have allowed, which also makes the suite faster
 * to run, not just more correct). Rejects with a clear, diagnostic
 * message naming exactly which signal(s) never arrived, rather than
 * leaving the caller to rediscover "DB is undefined" from a generic
 * downstream crash.
 */
function waitForAppReady(window, { maxWaitMs = 10000, checkIntervalMs = 100 } = {}) {
    return new Promise((resolve, reject) => {
        const start = Date.now();
        const tick = () => {
            if (isReady(window)) {
                resolve();
                return;
            }
            if (Date.now() - start >= maxWaitMs) {
                const missing = READINESS_SIGNALS.filter(name => typeof window[name] === 'undefined');
                reject(new Error(
                    `waitForAppReady: timed out after ${maxWaitMs}ms. ` +
                    `Still undefined: ${missing.join(', ')}. ` +
                    `This means init() genuinely never completed in this run -- ` +
                    `a real failure, not just a slow one. Check for a thrown error ` +
                    `earlier in this test's own console output.`
                ));
                return;
            }
            setTimeout(tick, checkIntervalMs);
        };
        tick();
    });
}

module.exports = { waitForAppReady, isReady, READINESS_SIGNALS };
