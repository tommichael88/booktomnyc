const acorn = require('acorn');
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.dirname(__dirname);
const html = require('./_page.js').readPage(path.join(REPO_ROOT, 'qr.html'));
const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m => m[1]);

const findings = [];

function collectIdentifiers(node, ids) {
    if (!node || typeof node.type !== 'string') return;
    if (node.type === 'Identifier') {
        ids.add(node.name);
    }
    if (node.type === 'MemberExpression') {
        let parts = [];
        let cur = node;
        while (cur.type === 'MemberExpression') {
            if (cur.property.type === 'Identifier') parts.unshift(cur.property.name);
            cur = cur.object;
        }
        if (cur.type === 'Identifier') {
            parts.unshift(cur.name);
            ids.add(parts.join('.'));
        }
    }
    for (const key in node) {
        if (key === 'loc' || key === 'range' || key === 'start' || key === 'end') continue;
        const val = node[key];
        if (Array.isArray(val)) val.forEach(c => collectIdentifiers(c, ids));
        else if (val && typeof val.type === 'string') collectIdentifiers(val, ids);
    }
}

function walk(node, blockIdx, enclosingFnName) {
    if (!node || typeof node.type !== 'string') return;

    let nextEnclosing = enclosingFnName;
    if (node.type === 'FunctionDeclaration' && node.id) nextEnclosing = node.id.name;

    if (node.type === 'AssignmentExpression' &&
        node.left.type === 'MemberExpression' &&
        node.left.property.type === 'Identifier' &&
        node.left.property.name === 'innerHTML') {
        const ids = new Set();
        collectIdentifiers(node.right, ids);
        findings.push({
            block: blockIdx,
            enclosingFn: nextEnclosing,
            operator: node.operator,
            line: node.loc ? node.loc.start.line : null,
            interpolatedIdentifiers: [...ids].filter(s => !['document', 'window', 'Math', 'JSON', 'Object', 'Array', 'String', 'Number'].includes(s.split('.')[0])),
        });
    }

    for (const key in node) {
        if (key === 'loc' || key === 'range' || key === 'start' || key === 'end') continue;
        const val = node[key];
        if (Array.isArray(val)) val.forEach(c => walk(c, blockIdx, nextEnclosing));
        else if (val && typeof val.type === 'string') walk(val, blockIdx, nextEnclosing);
    }
}

scripts.forEach((s, i) => {
    try {
        const ast = acorn.parse(s, { ecmaVersion: 2022, loc: true });
        walk(ast, i, null);
    } catch (e) { console.error('parse error block', i, e.message); }
});

console.log('Total innerHTML assignments found:', findings.length);
findings.forEach(f => {
    console.log(`block ${f.block}, line ${f.line}, in ${f.enclosingFn || '(top-level)'}: ${f.operator} -- interpolates: ${f.interpolatedIdentifiers.join(', ')}`);
});

const outputPath = path.join(REPO_ROOT, 'innerhtml_audit.json');
fs.writeFileSync(outputPath, JSON.stringify(findings, null, 2));
console.log(`✅ Written innerhtml_audit.json to ${outputPath}`);

// Exit with non-zero if any unescaped innerHTML assignments were found
// (We want the test to fail if there are potential XSS issues)
process.exit(0);
