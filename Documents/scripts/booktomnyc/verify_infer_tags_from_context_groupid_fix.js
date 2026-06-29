#!/usr/bin/env node
/**
 * verify_infer_tags_from_context_groupid_fix.js
 *
 * Regression test for a real, severe, completely-dead-on-arrival bug
 * found via direct, specific pushback pointing at real code from an
 * earlier version of qr.html (`_BRICK_HINTS`, the "fireplace ->
 * #brick_wall" mechanism).
 *
 * THE REAL BUG: `inferTagsFromContext(text, cat)` never accepted or
 * passed a `groupId` to `tagValidForCategory`. When
 * `tagValidForCategory`'s group-level check was correctly tightened in
 * an earlier, unrelated fix this session (`!!groupId &&
 * gids.includes(groupId)` — confirmed via the function's own comment,
 * "This replaces an earlier version where applicable_group_ids only
 * acted as an OR-fallback"), `inferTagsFromContext` was never updated
 * to thread the new, required parameter through. Both real, group-
 * scoped contextual inferences it makes (#brick_wall from "fireplace"/
 * "brick"/etc, #high_ceiling from "vaulted"/"cathedral"/etc) became
 * structurally, permanently dead — `!!undefined` is always `false`,
 * so neither could EVER fire again, for any input, regardless of how
 * clearly the user's text matched.
 *
 * This was a genuinely real, working, intentional feature — not a
 * theoretical risk — silently deprecated by an otherwise-correct fix
 * elsewhere, confirmed via direct trace of the real history, exactly
 * as described in the pushback that found it.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const REPO_ROOT = path.dirname(__dirname);
const QR_HTML = fs.readFileSync(path.join(REPO_ROOT, 'qr.html'), 'utf8');
const DB = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'btnyc.json'), 'utf8'));

let pass = 0, fail = 0;
function check(label, condition) {
    if (condition) { pass++; console.log(`  ✓ ${label}`); }
    else { fail++; console.log(`  ✗ ${label}`); }
}

function findFn(name) {
    const m = QR_HTML.match(new RegExp('function\\s+' + name + '\\s*\\([^)]*\\)\\s*\\{'));
    if (!m) return null;
    let depth = 0, start = m.index, i = m.index + m[0].length - 1;
    for (let j = i; j < QR_HTML.length; j++) {
        if (QR_HTML[j] === '{') depth++;
        else if (QR_HTML[j] === '}') { depth--; if (depth === 0) return QR_HTML.slice(start, j + 1); }
    }
    return null;
}

console.log('=== inferTagsFromContext now genuinely accepts and passes a real groupId ===');
check('the function signature now includes a groupId parameter', /function inferTagsFromContext\(text, cat, groupId\)/.test(QR_HTML));
check('the real, live call site now passes S.intent?._groupId', /inferTagsFromContext\(desc, detCat, S\.intent\?\._groupId\)/.test(QR_HTML));

const brickHintsLine = "const _BRICK_HINTS = new Set(['fireplace', 'brick', 'concrete', 'stone', 'mantel', 'mantle', 'chimney', 'masonry', 'cinder block', 'cinderblock', 'tile wall', 'cement']);";
const code = brickHintsLine + '\n' + [findFn('tagValidForCategory'), findFn('inferTagsFromContext')].join('\n\n');
const sandbox = { DB, SERVICE_DATA: DB, window: { DB }, console };
sandbox.global = sandbox;
vm.createContext(sandbox);
vm.runInContext(code, sandbox, { filename: 'infer_tags_fix' });

console.log('\n=== The real, exact, originally-described case now genuinely works ===');
{
    const result = sandbox.inferTagsFromContext(
        'I need to mount a picture of a fireplace above my bedroom wall',
        'wall_mounting', 'wall_mounting_brick_or_concrete'
    );
    check('"fireplace" + the correct, real group correctly infers #brick_wall',
        result.some(r => r.tid === '#brick_wall'));
}

console.log('\n=== The real, group-level scoping logic still correctly blocks a wrong group (the fix restores the parameter, it does not bypass the check) ===');
{
    const result = sandbox.inferTagsFromContext(
        'I need to mount a picture of a fireplace above my bedroom wall',
        'wall_mounting', 'wall_mounting_tv_flatscreen'
    );
    check('a real but WRONG group correctly does NOT infer #brick_wall',
        !result.some(r => r.tid === '#brick_wall'));
}

console.log('\n=== The second, real instance of the identical bug (#high_ceiling) is also fixed ===');
{
    const result = sandbox.inferTagsFromContext(
        'I need to mount a tv on a vaulted ceiling wall',
        'wall_mounting', 'wall_mounting_tv_flatscreen'
    );
    check('"vaulted" + a real, valid group correctly infers #high_ceiling',
        result.some(r => r.tid === '#high_ceiling'));
}

console.log(`\n[inferTagsFromContext groupId fix verification] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
process.exit(fail > 0 ? 1 : 0);
