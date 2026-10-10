/**
 * _page.js -- the one place that knows how the page's EXTERNAL scripts map to files in this repo, and how to read "the page" the way a browser runs it.
 *
 * WHY THIS EXISTS (T158; R-INVARIANT-SINGLEDEF, R-SYSTEM-SCRIPT):
 * qr.html used to carry every module inline, so a test that wanted a function read qr.html and found it. The operator has since moved four components
 * (trace, nlp_engine, appReducer, store) to their own files, loaded by absolute URL:
 *
 *     <script src="https://tommichael88.github.io/booktomnyc/modules/nlp_engine.js"></script>
 *
 * A test that reads qr.html text alone no longer sees those functions, and the old extractor "fixed" that with a bare-substring fallback that silently wrote the
 * WRONG block under a module's name (it extracted the orchestrator as nlp_engine.js). So there is exactly one rule, stated here:
 *
 *   A <script src> whose URL starts with DEPLOY_BASE is the repo file at the rest of the URL (".../booktomnyc/modules/store.js" -> <repo>/modules/store.js).
 *   assemble() puts that file's text in place of the tag, in the tag's position: the document a browser would execute, in the order it would execute it.
 *   A tag that names a file the repo does not have is an ERROR (never skipped, never guessed). A tag on any other host is left alone,
 *   and so is the tracer's (TRACER_PATHS below).
 *
 * Every harness reader that needs "the page" (_qr_blocks.js, _engine.js, extract_modules.js, extract_engine.py via the CLI below, the browser tests' request
 * interceptor) goes through this file. Nothing else in the harness restates the URL-to-file rule.
 *
 * CLI:  node test_harness/_page.js [path/to/qr.html]    prints the assembled document to stdout
 *       node test_harness/_page.js --list [qr.html]     prints "<url>\t<repo path>\t<exists>" per external script
 *
 * Files whose name starts with "_" are helpers, not tests: run_all.sh only globs verify_*.js.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
const DEPLOY_BASE = 'https://tommichael88.github.io/booktomnyc/';
const QR_PATH = process.env.BTNYC_QR_FILE ? path.resolve(process.env.BTNYC_QR_FILE) : path.join(REPO_ROOT, 'qr.html');
// Where the external files are looked up. Defaults to the repo; a test that analyses a historical copy may point it elsewhere.
const FILES_ROOT = process.env.BTNYC_PAGE_ROOT ? path.resolve(process.env.BTNYC_PAGE_ROOT) : REPO_ROOT;

// The tracer is the one external script the harness does NOT assemble in. It is observation-only and optional (#77: "trace is observation-only; a trace code path
// that affects results is a defect"), the page runs without it, and every analysis of the page's own code (layers, extraction, ship gate) has always been taken
// without it. A test that wants the tracer present loads it deliberately (verify_trace_observation_only.js, render_diff.js --trace). Its source of truth is
// modules/trace.js ('trace.js' is the pre-T158 location, which older copies of qr.html still name).
const TRACER_PATHS = new Set(['modules/trace.js', 'trace.js']);

const SCRIPT_SRC_RE = /<script\b([^>]*?)\bsrc\s*=\s*(?:"([^"]+)"|'([^']+)')([^>]*)>\s*<\/script>/gi;

/** The repo-relative path a deployed URL stands for, or null when the URL is not under DEPLOY_BASE. Rejects anything that would leave the repo. */
function repoPathOfUrl(url) {
    if (typeof url !== 'string' || !url.startsWith(DEPLOY_BASE)) return null;
    const rel = decodeURIComponent(url.slice(DEPLOY_BASE.length).split(/[?#]/)[0]);
    if (!rel || rel.startsWith('/') || rel.split('/').some(s => s === '..' || s === '' || s === '.')) return null;
    return rel;
}

/** Every <script src> in `html` as { tag, url, repoPath, index }. repoPath is null for a script on another host. */
function externalScripts(html) {
    const out = [];
    SCRIPT_SRC_RE.lastIndex = 0;
    let m;
    while ((m = SCRIPT_SRC_RE.exec(html)) !== null) {
        const url = m[2] || m[3];
        out.push({ tag: m[0], url, repoPath: repoPathOfUrl(url), index: m.index });
    }
    return out;
}

/** The document a browser would run: each deployed external script replaced, in place, by an inline <script> holding the repo file's text. */
function assemble(html, filesRoot) {
    const root = filesRoot || FILES_ROOT;
    return html.replace(SCRIPT_SRC_RE, (tag, _a, dq, sq) => {
        const url = dq || sq, rel = repoPathOfUrl(url);
        if (rel === null || TRACER_PATHS.has(rel)) return tag;
        const file = path.join(root, rel);
        if (!fs.existsSync(file)) throw new Error(`_page.js: qr.html loads ${url} but the repo has no ${rel} (looked in ${root})`);
        const text = fs.readFileSync(file, 'utf8');
        if (/<\/script/i.test(text)) throw new Error(`_page.js: ${rel} contains "</script", which cannot be inlined into a <script> block`);
        return `<script>\n${text}\n</script>`;
    });
}

/** Read qr.html (or `qrPath`) and assemble it. */
function readPage(qrPath, filesRoot) {
    return assemble(fs.readFileSync(qrPath || QR_PATH, 'utf8'), filesRoot);
}

/**
 * For a browser test with request interception on: the local file that answers `url`, or null if the page's own request for it should be handled as before.
 * (The deployed origin is not reachable from the test machine, and the page's CSP allows scripts only from 'self'; serving the repo's own file is the
 * browser-run equivalent of assemble().)
 */
function localFileForUrl(url, filesRoot) {
    const rel = repoPathOfUrl(url);
    if (rel === null) return null;
    const file = path.join(filesRoot || FILES_ROOT, rel);
    return fs.existsSync(file) ? file : null;
}

/**
 * For a browser test with request interception on that opens the page from disk (file://.../qr.html): the response that stands in for that document request --
 * the ASSEMBLED page, so the browser gets the modules inline instead of requesting them from the deployed origin. (A file:// page cannot load them from there:
 * the page's Content-Security-Policy allows scripts only from 'self', and the request is blocked before it is made. The production shape -- the page served
 * from the deployed origin, the modules fetched from it -- is exercised by verify_external_modules_boot.js.) Returns null for any other request.
 */
function documentResponse(url, filesRoot) {
    const bare = String(url).split('?')[0].split('#')[0];
    if (!/^file:\/\/\/.+\.html$/.test(bare)) return null;
    const file = decodeURIComponent(bare.slice('file://'.length));
    if (!fs.existsSync(file)) return null;
    return { status: 200, contentType: 'text/html; charset=utf-8', body: readPage(file, filesRoot) };
}

module.exports = { DEPLOY_BASE, QR_PATH, REPO_ROOT, repoPathOfUrl, externalScripts, assemble, readPage, localFileForUrl, documentResponse };

if (require.main === module) {
    const args = process.argv.slice(2), list = args.includes('--list'), file = args.find(a => !a.startsWith('--'));
    const qr = file ? path.resolve(file) : QR_PATH;
    if (list) {
        for (const s of externalScripts(fs.readFileSync(qr, 'utf8'))) {
            console.log([s.url, s.repoPath || '(other host)', s.repoPath ? fs.existsSync(path.join(FILES_ROOT, s.repoPath)) : '-'].join('\t'));
        }
    } else {
        process.stdout.write(readPage(qr));
    }
}
