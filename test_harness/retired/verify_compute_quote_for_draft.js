#!/usr/bin/env node
/**
 * verify_compute_quote_for_draft.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const REPO_ROOT = path.resolve(__dirname, '..');
const btnycPath = path.join(REPO_ROOT, "btnyc.py");
const src = fs.readFileSync(btnycPath, "utf-8");

// Strict regex matching Python's expectations (no loose EOF fallback)
const m = src.match(/class\s+CMSBridge[\s\S]*?(?=\nclass\s|\nconst\s+_cms_bridge)/);
if (!m) {
    console.error("FAIL: could not find CMSBridge class in btnyc.py — has it moved/renamed?");
    process.exit(1);
}

// Safely execute in a VM context and explicitly attach the class to the sandbox global
const sandbox = { console };
vm.createContext(sandbox);
vm.runInContext(m[0] + '\n;globalThis.CMSBridge = CMSBridge;', sandbox);

const bridge = new sandbox.CMSBridge();
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

// Omitted type check allows it to crash if undefined, mirroring Python
if (!bridge.available()) {
    console.log(`SKIP: ${bridge.unavailable_reason()}`);
    process.exit(0);
}

const btnycJsonPath = path.join(REPO_ROOT, "btnyc.pyon");
const originalBtnycJsonText = fs.readFileSync(btnycJsonPath, "utf-8");
const full_raw = JSON.parse(originalBtnycJsonText);
const real_svc = full_raw.services.find(s => s.id === "toilet_install");
const real_base_price = real_svc.financial_engine.base_price;

console.log("=== Single-field draft edit flows through correctly ===");
const draft = JSON.parse(JSON.stringify(real_svc));
draft.financial_engine.base_price = real_base_price + 50;
const [result, err] = bridge.compute_quote_for_draft(draft, full_raw);
check("no error", err == null);
if (result) {
    check(`draft base_price (${real_base_price + 50}) reflected in laborEstimate`, result.laborEstimate === real_base_price + 50);
}

console.log("\n=== Real btnyc.pyon on disk is never modified ===");
const afterText = fs.readFileSync(btnycJsonPath, "utf-8");
check("btnyc.pyon file content byte-identical after draft preview call", afterText === originalBtnycJsonText);
const after_raw = JSON.parse(afterText);
const after_svc = after_raw.services.find(s => s.id === "toilet_install");
check("real base_price unchanged in re-parsed JSON", after_svc.financial_engine.base_price === real_base_price);

console.log("\n=== Multiple simultaneous draft changes apply together ===");
const draft2 = JSON.parse(JSON.stringify(real_svc));
draft2.financial_engine.checkout_state = "project_based";
draft2.default_estimates.disclaimer = "project_based";
const [result2, err2] = bridge.compute_quote_for_draft(draft2, full_raw);
check("no error", err2 == null);
if (result2) {
    check("checkoutStateKey reflects draft change", result2.checkoutStateKey === "project_based");
    const disclaimerText = (result2.disclaimerText || "").toLowerCase();
    check("disclaimerText reflects the project_based SSOT entry", disclaimerText.includes("non") && disclaimerText.includes("binding"));
}

console.log(`\n[compute_quote_for_draft verification] ${pass_count} passed, ${fail_count} failed (of ${pass_count + fail_count} checks)\n`);
process.exit(fail_count > 0 ? 1 : 0);
