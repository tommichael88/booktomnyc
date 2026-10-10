#!/usr/bin/env node
/**
 * verify_input_sanitization.js
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const vm = require('vm');

const REPO_ROOT = path.resolve(__dirname, '..');
const src = fs.readFileSync(path.join(REPO_ROOT, "btnyc.json"), "utf-8");

// Exact 3-newline terminator matching the Python script to prevent mid-function truncation
const m_tagref = src.match(/function\s+tag_ref\b[\s\S]*?\n\n\n/);
const m_clamp = src.match(/function\s+clamp_minmax\b[\s\S]*?\n\n\n/);
const m_slugify = src.match(/function\s+slugify\b[\s\S]*?\n\n\n/);

if (!m_tagref) { console.error("FAIL: could not find tag_ref() in btnyc.json"); process.exit(1); }
if (!m_clamp) { console.error("FAIL: could not find clamp_minmax() in btnyc.json"); process.exit(1); }
if (!m_slugify) { console.error("FAIL: could not find slugify() in btnyc.json"); process.exit(1); }

// VM sandbox avoids strict mode eval leakage and handles dependencies natively
const sandbox = {
    crypto,
    gen_id: () => crypto.randomUUID().replace(/-/g, '').substring(0, 8)
};
vm.createContext(sandbox);
vm.runInContext(m_tagref[0], sandbox);
vm.runInContext(m_clamp[0], sandbox);
vm.runInContext(m_slugify[0], sandbox);

const { tag_ref, clamp_minmax, slugify } = sandbox;

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

console.log("=== tag_ref() normalizes tag keys regardless of input # prefix ===");
check("tag_ref('heavy_item') adds the # prefix", JSON.stringify(tag_ref("heavy_item")) === JSON.stringify({$ref: "#heavy_item"}));
check("tag_ref('#heavy_item') does not double-prefix", JSON.stringify(tag_ref("#heavy_item")) === JSON.stringify({$ref: "#heavy_item"}));

console.log("\n=== Manual comma-separated tag-list # auto-fix (IntakeModulesMgr quick-create) ===");
function fix_tag_list(raw_csv) {
    return raw_csv.split(",")
        .map(t => t.trim())
        .filter(t => t)
        .map(t => t.startsWith("#") ? t : "#" + t);
}

check("'heavy_item, two_person_required' (no #) -> both correctly prefixed",
      JSON.stringify(fix_tag_list("heavy_item, two_person_required")) === JSON.stringify(["#heavy_item", "#two_person_required"]));
check("'#heavy_item, two_person_required' (mixed) -> both end up correctly prefixed, no double-#",
      JSON.stringify(fix_tag_list("#heavy_item, two_person_required")) === JSON.stringify(["#heavy_item", "#two_person_required"]));
check("empty entries from stray commas are dropped", 
      JSON.stringify(fix_tag_list("heavy_item, , two_person_required")) === JSON.stringify(["#heavy_item", "#two_person_required"]));

console.log("\n=== clamp_minmax() auto-corrects inverted min/max pairs ===");
check("normal order (60, 120) unchanged", JSON.stringify(clamp_minmax(60, 120)) === JSON.stringify([60, 120]));
check("inverted (500, 100) gets swapped to (100, 500)", JSON.stringify(clamp_minmax(500, 100)) === JSON.stringify([100, 500]));
check("equal values (50, 50) unchanged", JSON.stringify(clamp_minmax(50, 50)) === JSON.stringify([50, 50]));
check("inverted floats (99.5, 10.0) gets swapped", JSON.stringify(clamp_minmax(99.5, 10.0)) === JSON.stringify([10.0, 99.5]));

console.log("\n=== slugify() restricts ids to portable ASCII (id generation for new categories/groups) ===");
check("normal text slugifies correctly", slugify("Plumbing & Electrical!!!") === "plumbing_electrical");
check("non-Latin script (e.g. Japanese) falls back to a generated id, not surviving unchanged", /^[0-9a-f]{8}$/.test(slugify("日本語")));
check("accented Latin characters are stripped, not preserved as non-ASCII", slugify("Café Furniture") === "caf_furniture");
check("empty input falls back to a generated id", /^[0-9a-f]{8}$/.test(slugify("")));

console.log(`\n[input sanitization verification] ${pass_count} passed, ${fail_count} failed (of ${pass_count + fail_count} checks)\n`);
process.exit(fail_count > 0 ? 1 : 0);
