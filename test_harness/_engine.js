/**
 * _engine.js -- load the pricing / NLP / orchestrator MODULES whole, straight from qr.html.
 *
 * Why (T136): nine tests each carried their own findFn() that cherry-picked ONE function
 * out of qr.html by name. Every time a helper was added next to that function (a new
 * constant, a quiet flag, a shared extractor) those sandboxes lost a dependency and the
 * test failed with "X is not defined" -- noise unrelated to what the test asserts. Whole
 * modules cannot go stale by construction.
 *
 *   engineAwareFindFn(origFindFn) -> a findFn that, for any function declared in the three
 *   engine modules, returns ONE source string that (a) runs the whole modules inside a
 *   wrapper function (so repeated loads or a test's own helper consts can never collide)
 *   and (b) exports every module-level function onto the sandbox global, exactly what the
 *   cherry-picked version did for a single name. Anything else falls through to the
 *   test's own extractor.
 */
const fs = require('fs'), path = require('path');
const page = require('./_page.js');   // T158: a module that moved out of qr.html is still part of the page (see _page.js)
const ROOT = process.env.QR_ROOT || path.dirname(__dirname);
const MODULES = ['pricing_engine.js', 'nlp_engine.js', 'orchestrator_engine.js'];

function scriptBlocks(html) {
  const out = [], re = /<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g;
  let m;
  while ((m = re.exec(html))) {
    let c = m[1];
    const iife = c.match(/^\s*\(function\s*\(\)\s*\{([\s\S]*)\}\s*\)\s*\(\s*\)\s*;?\s*$/);
    out.push(iife ? iife[1] : c);
  }
  return out;
}

let cache = null;
function engine(qrPath = path.join(ROOT, 'qr.html')) {
  if (cache && cache.path === qrPath) return cache;
  const blocks = scriptBlocks(page.readPage(qrPath, ROOT));
  const parts = MODULES.map(marker => {
    const re = new RegExp('^\\s*/\\*\\*\\s*\\r?\\n\\s*\\*\\s*' + marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b');
    const b = blocks.find(x => re.test(x));
    if (!b) throw new Error(`_engine.js: module "${marker}" not found in ${qrPath}`);
    return b;
  });
  const code = parts.join('\n\n');
  // Top-level function declarations only -- found by PARSING each module (acorn), never by indentation. (T158: the old rule, "0-5 spaces of indent", silently
  // dropped every function once the operator's formatter re-indented the module to 8; a name that is missing here is "X is not defined" in forty tests.) A function
  // inside another function is not exported, and a function preserved "for historical reference" in a comment is not a declaration at all, so the parse needs no
  // comment-blanking pass.
  const acorn = require('acorn');
  const nameSet = new Set();
  const scan = n => {   // declarations at the module's own level, including those inside top-level blocks/if/try (sloppy-mode hoisting), never inside a function
    if (!n || typeof n.type !== 'string') return;
    if (n.type === 'FunctionDeclaration') { if (n.id) nameSet.add(n.id.name); return; }
    if (n.type === 'FunctionExpression' || n.type === 'ArrowFunctionExpression' || n.type === 'ClassDeclaration' || n.type === 'ClassExpression') return;
    for (const k of Object.keys(n)) { const v = n[k]; if (Array.isArray(v)) v.forEach(scan); else if (v && typeof v.type === 'string') scan(v); }
  };
  for (const part of parts) acorn.parse(part, { ecmaVersion: 'latest', sourceType: 'script', allowReturnOutsideFunction: true, allowAwaitOutsideFunction: true }).body.forEach(scan);
  const names = [...nameSet];
  const wrapper = `(function(){
const __g = globalThis;
const window = __g.window || __g;
const document = __g.document || (function(){ const el=()=>({style:{},classList:{add(){},remove(){},contains:()=>false},appendChild(){},setAttribute(){},addEventListener(){},querySelector:()=>null,querySelectorAll:()=>[]}); return {getElementById:()=>null,querySelector:()=>null,querySelectorAll:()=>[],addEventListener(){},createElement:el,body:el()}; })();
${code}
${names.map(n => `try{ __g.${n} = ${n}; }catch(e){}`).join('\n')}
}).call(globalThis);`;
  cache = { path: qrPath, names: new Set(names), wrapper };
  return cache;
}

function engineAwareFindFn(orig) {
  return function (...args) {
    // works for findFn(name), findFn(text, name) and arr.map(findFn) (name, index, array)
    const name = [...args].reverse().find(a => typeof a === 'string' && /^[A-Za-z_$][\w$]*$/.test(a));
    const e = engine();
    if (name && e.names.has(name)) return e.wrapper;
    return orig.apply(this, args);
  };
}

module.exports = { engine, engineAwareFindFn };
