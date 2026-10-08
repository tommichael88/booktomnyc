const acorn = require('acorn');
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.dirname(__dirname);
const html = fs.readFileSync(path.join(REPO_ROOT, 'qr.html'), 'utf8');
const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m => m[1]);

const functions = [];

function collectFunctions(node, ancestors, blockIdx) {
    if (!node || typeof node.type !== 'string') return;
    let record = null;
    if (node.type === 'FunctionDeclaration' && node.id) {
        record = { name: node.id.name, node, blockIdx };
    } else if (node.type === 'VariableDeclarator' && node.id && node.id.type === 'Identifier' &&
               node.init && (node.init.type === 'ArrowFunctionExpression' || node.init.type === 'FunctionExpression')) {
        record = { name: node.id.name, node: node.init, blockIdx };
    }
    if (record) {
        const depth = ancestors.filter(a =>
            a.type === 'FunctionDeclaration' || a.type === 'FunctionExpression' || a.type === 'ArrowFunctionExpression'
        ).length;
        record.depth = depth;
        functions.push(record);
    }
    const newAncestors = ancestors.concat([node]);
    for (const key in node) {
        if (key === 'loc' || key === 'range' || key === 'start' || key === 'end') continue;
        const val = node[key];
        if (Array.isArray(val)) val.forEach(c => collectFunctions(c, newAncestors, blockIdx));
        else if (val && typeof val.type === 'string') collectFunctions(val, newAncestors, blockIdx);
    }
}

scripts.forEach((s, i) => {
    try {
        const ast = acorn.parse(s, { ecmaVersion: 2022, loc: true });
        collectFunctions(ast, [], i);
    } catch (e) { console.error('parse error block', i, e.message); }
});

function findStateMutations(node, results) {
    if (!node || typeof node.type !== 'string') return;
    if (node.type === 'AssignmentExpression' && node.left.type === 'MemberExpression') {
        let root = node.left;
        while (root.type === 'MemberExpression') root = root.object;
        if (root.type === 'Identifier' && (root.name === 'S' || root.name === 'State')) {
            results.push(root.name);
        }
    }
    if (node.type === 'CallExpression' && node.callee.type === 'MemberExpression') {
        const mutatorMethods = new Set(['push', 'pop', 'splice', 'shift', 'unshift', 'sort', 'reverse']);
        if (node.callee.property.type === 'Identifier' && mutatorMethods.has(node.callee.property.name)) {
            let root = node.callee.object;
            while (root.type === 'MemberExpression') root = root.object;
            if (root.type === 'Identifier' && (root.name === 'S' || root.name === 'State')) {
                results.push(root.name + ' (via .' + node.callee.property.name + ')');
            }
        }
    }
    for (const key in node) {
        if (key === 'loc' || key === 'range' || key === 'start' || key === 'end') continue;
        const val = node[key];
        if (Array.isArray(val)) val.forEach(c => findStateMutations(c, results));
        else if (val && typeof val.type === 'string') findStateMutations(val, results);
    }
}

const byName = {};
for (const fn of functions) {
    if (fn.depth > 1) continue;
    const mutations = [];
    findStateMutations(fn.node, mutations);
    byName[fn.name] = {
        name: fn.name,
        block: fn.blockIdx,
        depth: fn.depth,
        mutatesState: mutations.length > 0,
        mutationKinds: [...new Set(mutations)],
    };
}

console.log('Classified', Object.keys(byName).length, 'functions');
const mutators = Object.values(byName).filter(r => r.mutatesState);
console.log('Mutate S/State:', mutators.length);
console.log('Do not mutate S/State:', Object.keys(byName).length - mutators.length);

const outputPath = path.join(REPO_ROOT, 'state_mutation_classification.json');
fs.writeFileSync(outputPath, JSON.stringify(Object.values(byName), null, 2));
console.log(`✅ Written state_mutation_classification.json to ${outputPath}`);

// This is analysis; always exit with 0 (no pass/fail)
process.exit(0);
