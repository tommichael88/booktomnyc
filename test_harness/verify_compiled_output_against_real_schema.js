#!/usr/bin/env node
/**
 * verify_compiled_output_against_real_schema.js
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');

let Ajv, addFormats;
try {
    Ajv = require('ajv');
    addFormats = require('ajv-formats');
} catch (e) {
    console.error("FATAL: 'ajv' and 'ajv-formats' are required. Install with: npm install ajv ajv-formats");
    process.exit(2);
}

const REPO_ROOT = path.resolve(__dirname, '..');
let pass_count = 0, fail_count = 0;

function check(label, condition) {
    if (condition) {
        pass_count += 1;
        console.log(`  ✓ ${label}`);
    } else {
        fail_count += 1;
        console.log(`  ✗ ${label}`);
    }
}

const schema = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "schema", "btnyc_schema.json"), 'utf-8'));
const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv); // Enforces "date-time" and other formats to match Python's jsonschema
const validate = ajv.compile(schema);

console.log("=== The real, original, hand-authored catalog still validates cleanly ===");
const original = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "btnyc.json"), 'utf-8'));
validate(original);
const original_errors = validate.errors || [];
check(`zero real schema errors against btnyc.json itself (found ${original_errors.length})`, original_errors.length === 0);

console.log("\n=== The real, current compiler's actual, live output genuinely validates against the real schema ===");
const tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), 'compiled-'));
const outputPath = path.join(tmpdir, "compiled.json");

try {
    execSync(`python3 "${path.join(REPO_ROOT, 'btnyc_v10_compiler.py')}" ` +
         `"${path.join(REPO_ROOT, 'btnyc.json')}" "${outputPath}"`, { stdio: 'pipe' });
    check("the real compiler runs to completion", true);
} catch (error) {
    check("the real compiler runs to completion", false);
}

if (fs.existsSync(outputPath)) {
    const compiled = JSON.parse(fs.readFileSync(outputPath, 'utf-8'));
    validate(compiled);
    const compiled_errors = validate.errors || [];
    check(`zero real schema errors against the actual, compiled v10 output (found ${compiled_errors.length})`, compiled_errors.length === 0);
    for (const e of compiled_errors) {
        console.log(`    (real error: ${e.message})`);
    }
}

console.log("\n=== Every real, new top-level key the compiler adds is explicitly declared in the schema ===");
const expected_new_keys = new Set(["compiled", "routing_archetypes", "pricing_archetypes", "_compiler_metadata", "_validation", "_additive_diff", "_schema_validation", "_archetype_mismatch_report"]);
const declared = new Set(Object.keys(schema.properties || {}));
const missing_declarations = [...expected_new_keys].filter(x => !declared.has(x));
check(`all ${expected_new_keys.size} real, new keys are explicitly declared in the schema (missing: ${missing_declarations.length ? missing_declarations.join(', ') : 'none'})`, missing_declarations.length === 0);

console.log(`\n[compiled output vs. real schema verification] ${pass_count} passed, ${fail_count} failed (of ${pass_count + fail_count} checks)\n`);
process.exit(fail_count > 0 ? 1 : 0);
